import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PosOrdersService } from './pos-orders.service';
import {
  PosOrderStatus,
  PosPaymentMethod,
} from './entities/pos-order.entity';

// PosOrdersService.buildOrderItems() ilgari har bir buyurtma bandi uchun
// alohida `menuItemRepo.findOneBy()` so'rovi yuborardi (N+1, POS'da har bir
// buyurtma yaratilishida/bandi qo'shilishida chaqiriladigan "hot path" —
// 2026-09-02 polish auditi Medium topilmasi). Bu testlar aynan shu
// regressiyaning oldini oladi: bandlar soniga qaramay `menuItemRepo.find()`
// FAQAT BIR MARTA chaqirilishini tekshiradi.
describe('PosOrdersService.buildOrderItems — N+1 tuzatish', () => {
  function createService(
    menuItems: Array<{
      id: string;
      name: string;
      price: string;
      isActive: boolean;
      tenantId: string;
    }>,
  ) {
    const orderRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((order: unknown) => Promise.resolve(order)),
    };
    const orderItemRepo = {
      create: jest.fn((data: unknown) => data),
    };
    const menuItemRepo = {
      find: jest.fn(() => Promise.resolve(menuItems)),
    };
    const invoicingService = {};
    const accountingService = {};
    const service = new PosOrdersService(
      orderRepo as never,
      orderItemRepo as never,
      menuItemRepo as never,
      invoicingService as never,
      accountingService as never,
    );
    return { service, orderRepo, orderItemRepo, menuItemRepo };
  }

  it("bandlar soni (10 tagacha) qanchalik ko'p bo'lishidan qat'iy nazar, menyu qidiruvi FAQAT BIR MARTA chaqiriladi", async () => {
    const menuItems = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      name: `Taom ${i}`,
      price: '10000.00',
      isActive: true,
      tenantId: 't1',
    }));
    const { service, menuItemRepo } = createService(menuItems);

    const order = await service.create('t1', 'p1', 'o1', 'u1', {
      items: menuItems.map((m) => ({ menuItemId: m.id, quantity: 1 })),
    });

    expect(menuItemRepo.find).toHaveBeenCalledTimes(1);
    expect((order as unknown as { items: unknown[] }).items).toHaveLength(10);
  });

  it('menyu taomi topilmasa NotFoundException tashlaydi (batched qidiruvda ham)', async () => {
    const { service } = createService([
      {
        id: 'm1',
        name: 'Osh',
        price: '15000.00',
        isActive: true,
        tenantId: 't1',
      },
    ]);

    await expect(
      service.create('t1', 'p1', 'o1', 'u1', {
        items: [
          { menuItemId: 'm1', quantity: 1 },
          { menuItemId: 'missing', quantity: 1 },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("faol bo'lmagan (isActive=false) menyu taomi uchun BadRequestException tashlaydi", async () => {
    const { service } = createService([
      {
        id: 'm1',
        name: 'Eskirgan taom',
        price: '5000.00',
        isActive: false,
        tenantId: 't1',
      },
    ]);

    await expect(
      service.create('t1', 'p1', 'o1', 'u1', {
        items: [{ menuItemId: 'm1', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("bir xil menyu taomi bir necha marta buyurtma qilinsa ham, so'rov faqat bitta ID uchun yuboriladi (dublikat ID olib tashlanadi)", async () => {
    const { service, menuItemRepo } = createService([
      {
        id: 'm1',
        name: 'Osh',
        price: '20000.00',
        isActive: true,
        tenantId: 't1',
      },
    ]);

    await service.create('t1', 'p1', 'o1', 'u1', {
      items: [
        { menuItemId: 'm1', quantity: 2 },
        { menuItemId: 'm1', quantity: 1 },
      ],
    });

    expect(menuItemRepo.find).toHaveBeenCalledTimes(1);
    const callArg = menuItemRepo.find.mock.calls[0][0] as {
      where: { id: unknown; tenantId: string };
    };
    expect(callArg.where.tenantId).toBe('t1');
  });
});


// 🔴 2026-09-05 (kod auditi): `pay` holat tekshiruvini QULFSIZ qilardi.
// Ikkita bir vaqtdagi so'rov ikkalasi ham `OPEN` ni ko'rib o'tib ketardi —
// folio'ga ikkita bir xil qator yozilar va `fb_revenue` ikki marta
// kreditlanardi (250 000 lik buyurtma mehmon hisobida 500 000 bo'lardi).
describe("PosOrdersService.pay — qulf ostidagi holat tekshiruvi", () => {
  function createService(qulflanganHolat: PosOrderStatus) {
    const ochiqOrder = {
      id: 'o1',
      tenantId: 't1',
      propertyId: 'p1',
      status: PosOrderStatus.OPEN,
      totalAmount: '250000.00',
      tableNumber: '5',
      items: [{ id: 'i1' }],
    };
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(ochiqOrder),
      save: jest.fn((o: unknown) => Promise.resolve(o)),
      // Qulflangan o'qish — bu yerda "raqib so'rov allaqachon to'lab
      // bo'lgan" holatni taqlid qilamiz.
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ ...ochiqOrder, status: qulflanganHolat }),
      })),
    };
    const invoicingService = { chargeToFolioByBooking: jest.fn() };
    const accountingService = { postSimpleEntry: jest.fn() };
    const service = new PosOrdersService(
      orderRepo as never,
      { create: jest.fn() } as never,
      { find: jest.fn() } as never,
      invoicingService as never,
      accountingService as never,
    );
    return { service, orderRepo, invoicingService, accountingService };
  }

  it("qulf ostida buyurtma allaqachon PAID bo'lsa, ikkinchi to'lov rad etiladi", async () => {
    const { service, invoicingService, accountingService } = createService(
      PosOrderStatus.PAID,
    );

    await expect(
      service.pay('t1', 'p1', 'o1', {
        paymentMethod: PosPaymentMethod.CASH,
      } as never),
    ).rejects.toThrow(ConflictException);

    // Eng muhimi: ikkinchi provodka ham, ikkinchi folio qatori ham yo'q.
    expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
    expect(invoicingService.chargeToFolioByBooking).not.toHaveBeenCalled();
  });

  it("qulf ostida hamon OPEN bo'lsa, to'lov o'tadi va qulf so'ralgan bo'ladi", async () => {
    const { service, orderRepo, accountingService } = createService(
      PosOrderStatus.OPEN,
    );

    await service.pay('t1', 'p1', 'o1', {
      paymentMethod: PosPaymentMethod.CASH,
    } as never);

    expect(orderRepo.createQueryBuilder).toHaveBeenCalled();
    expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
      expect.objectContaining({ creditSystemKey: 'fb_revenue' }),
    );
  });
});
