import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PosOrdersService } from './pos-orders.service';

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
