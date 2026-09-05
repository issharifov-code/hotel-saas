import { NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

// PurchaseOrdersService.create() ilgari har bir buyurtma bandi uchun alohida
// `stockItemRepo.findOneBy()` so'rovi yuborardi (N+1 — 2026-09-02 polish
// auditi Medium topilmasi). Bu testlar aynan shu regressiyaning oldini
// oladi: bandlar soniga qaramay `stockItemRepo.find()` FAQAT BIR MARTA
// chaqirilishini tekshiradi.
describe('PurchaseOrdersService.create — N+1 tuzatish', () => {
  function createService(
    stockItems: Array<{ id: string; tenantId: string }>,
    supplier: { id: string } | null = { id: 's1' },
  ) {
    const poRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((po: unknown) => Promise.resolve(po)),
    };
    const poItemRepo = {
      create: jest.fn((data: unknown) => data),
    };
    const stockItemRepo = {
      find: jest.fn(() => Promise.resolve(stockItems)),
    };
    const supplierRepo = {
      findOneBy: jest.fn(() => Promise.resolve(supplier)),
    };
    const stockService = {};
    const service = new PurchaseOrdersService(
      poRepo as never,
      poItemRepo as never,
      stockItemRepo as never,
      supplierRepo as never,
      stockService as never,
    );
    return { service, poRepo, poItemRepo, stockItemRepo, supplierRepo };
  }

  it("bandlar soni (10 tagacha) qanchalik ko'p bo'lishidan qat'iy nazar, tovar qidiruvi FAQAT BIR MARTA chaqiriladi", async () => {
    const stockItems = Array.from({ length: 10 }, (_, i) => ({
      id: `si${i}`,
      tenantId: 't1',
    }));
    const { service, stockItemRepo } = createService(stockItems);

    const po = await service.create('t1', 'p1', 'w1', 'u1', {
      supplierId: 's1',
      items: stockItems.map((s) => ({
        stockItemId: s.id,
        quantityOrdered: '5',
        unitCost: '1000.00',
      })),
    });

    expect(stockItemRepo.find).toHaveBeenCalledTimes(1);
    expect((po as unknown as { items: unknown[] }).items).toHaveLength(10);
  });

  it("tovar topilmasa NotFoundException tashlaydi (batched qidiruvda ham, birinchi topilmagan band ID'si bilan)", async () => {
    const { service } = createService([{ id: 'si1', tenantId: 't1' }]);

    await expect(
      service.create('t1', 'p1', 'w1', 'u1', {
        supplierId: 's1',
        items: [
          { stockItemId: 'si1', quantityOrdered: '1', unitCost: '1000.00' },
          { stockItemId: 'missing', quantityOrdered: '1', unitCost: '1000.00' },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("ta'minotchi topilmasa NotFoundException tashlaydi (tovar qidiruvi chaqirilmaydi)", async () => {
    const { service, stockItemRepo } = createService(
      [{ id: 'si1', tenantId: 't1' }],
      null,
    );

    await expect(
      service.create('t1', 'p1', 'w1', 'u1', {
        supplierId: 'missing-supplier',
        items: [
          { stockItemId: 'si1', quantityOrdered: '1', unitCost: '1000.00' },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(stockItemRepo.find).not.toHaveBeenCalled();
  });

  it("bir xil tovar bir necha bandda takrorlansa ham, so'rov faqat unique ID'lar uchun yuboriladi", async () => {
    const { service, stockItemRepo } = createService([
      { id: 'si1', tenantId: 't1' },
    ]);

    await service.create('t1', 'p1', 'w1', 'u1', {
      supplierId: 's1',
      items: [
        { stockItemId: 'si1', quantityOrdered: '2', unitCost: '1000.00' },
        { stockItemId: 'si1', quantityOrdered: '3', unitCost: '1000.00' },
      ],
    });

    expect(stockItemRepo.find).toHaveBeenCalledTimes(1);
    const callArg = stockItemRepo.find.mock.calls[0][0] as {
      where: { tenantId: string };
    };
    expect(callArg.where.tenantId).toBe('t1');
  });
});

// 🔬 QABUL QILISH VA HOLAT O'TISHLARI (2026-09-05).
//
// NIMA UCHUN QO'SHILDI. Qoplama o'lchovida bu servis eng past
// uchlikda edi (39.8%) va qoplanmagan qismning deyarli hammasi
// `receive()` — ya'ni PULGA VA OMBOR QOLDIG'IGA TA'SIR QILADIGAN
// yagona metod. Unda uchta alohida qoida bor:
//
//   1. Buyurtma qilingandan ORTIQ qabul qilib bo'lmaydi. Aks holda
//      omborda mavjud bo'lmagan tovar paydo bo'ladi va FIFO
//      tannarxi buziladi.
//   2. Har bir qabul yangi StockLot yaratadi (FIFO uchun) — miqdor
//      va TANNARX buyurtma bandidan olinadi.
//   3. Barcha bandlar to'liq kelganda holat `received`, aks holda
//      `partially_received` bo'ladi.
//
// Yaxlitlash chegarasi (`1e-9`) ataylab: miqdorlar `numeric(_, 3)`
// va `Number()` orqali ikkilik kasrga aylanadi, ya'ni 3 ta 0.1 ning
// yig'indisi 0.30000000000000004 bo'lib chiqadi — tolerantliksiz
// oxirgi qabul "ortiqcha" deb rad etilardi.

import { PurchaseOrderStatus } from './entities/purchase-order.entity';

describe('PurchaseOrdersService — qabul qilish va holatlar', () => {
  interface FakeItem {
    id: string;
    stockItemId: string;
    quantityOrdered: string;
    quantityReceived: string;
    unitCost: string;
  }

  function createService(po: {
    status: PurchaseOrderStatus;
    items: FakeItem[];
    warehouseId?: string;
  }) {
    const poEntity = { id: 'po1', warehouseId: 'w1', ...po };
    const poRepo = {
      findOne: jest.fn(() => Promise.resolve(poEntity)),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const poItemRepo = {
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      // `receive` oxirida bandlarni QAYTA o'qiydi — mock ayni o'sha
      // (yangilangan) obyektlarni qaytaradi.
      find: jest.fn(() => Promise.resolve(poEntity.items)),
    };
    const stockService = { receiveLot: jest.fn(() => Promise.resolve({ id: 'lot1' })) };
    const service = new PurchaseOrdersService(
      poRepo as never,
      poItemRepo as never,
      {} as never,
      {} as never,
      stockService as never,
    );
    return { service, poRepo, poItemRepo, stockService, poEntity };
  }

  const item = (over: Partial<FakeItem> = {}): FakeItem => ({
    id: 'poi1',
    stockItemId: 'si1',
    quantityOrdered: '10.000',
    quantityReceived: '0.000',
    unitCost: '1500.00',
    ...over,
  });

  // 🔴 ENG MUHIM QOIDA. Ortiqcha qabul omborga "havodan" tovar
  // qo'shadi va o'rtacha tannarxni buzadi.
  it("buyurtma qilingandan ortiq qabul qilib bo'lmaydi", async () => {
    const { service, stockService } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item({ quantityOrdered: '10.000', quantityReceived: '4.000' })],
    });

    await expect(
      service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '7' }] } as never, 'u1'),
    ).rejects.toThrow(/ortiq qabul/);

    // Rad etilganda omborga HECH NARSA yozilmasligi kerak.
    expect(stockService.receiveLot).not.toHaveBeenCalled();
  });

  it("nol yoki manfiy miqdor rad etiladi", async () => {
    for (const qty of ['0', '-3']) {
      const { service, stockService } = createService({
        status: PurchaseOrderStatus.APPROVED,
        items: [item()],
      });
      await expect(
        service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: qty }] } as never, 'u1'),
      ).rejects.toThrow(/musbat/);
      expect(stockService.receiveLot).not.toHaveBeenCalled();
    }
  });

  it("buyurtmada yo'q band rad etiladi", async () => {
    const { service } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item()],
    });
    await expect(
      service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'boshqa', quantityReceived: '1' }] } as never, 'u1'),
    ).rejects.toThrow(/bandi topilmadi/);
  });

  // 🔴 TEKSHIRUV BARCHA BANDLAR UCHUN OLDIN BO'LADI. Ikki bandli
  // qabulda ikkinchisi noto'g'ri bo'lsa, BIRINCHISI ham omborga
  // yozilmasligi kerak — aks holda yarim qabul qilingan holat qoladi.
  it("bitta band xato bo'lsa, boshqasi ham omborga yozilmaydi", async () => {
    const { service, stockService } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [
        item({ id: 'poi1', quantityOrdered: '10.000' }),
        item({ id: 'poi2', stockItemId: 'si2', quantityOrdered: '5.000' }),
      ],
    });

    await expect(
      service.receive('t1', 'p1', 'po1', {
        lines: [
          { purchaseOrderItemId: 'poi1', quantityReceived: '2' },
          { purchaseOrderItemId: 'poi2', quantityReceived: '99' },
        ],
      } as never, 'u1'),
    ).rejects.toThrow(/ortiq qabul/);

    expect(stockService.receiveLot).not.toHaveBeenCalled();
  });

  it('to\'liq qabul qilinganda holat "received" bo\'ladi', async () => {
    const { service, poEntity } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item({ quantityOrdered: '10.000' })],
    });

    const result = await service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '10' }] } as never, 'u1');

    expect((result as unknown as { status: string }).status).toBe(PurchaseOrderStatus.RECEIVED);
    expect(poEntity.items[0].quantityReceived).toBe('10.000');
  });

  it('qisman qabulda holat "partially_received" bo\'ladi', async () => {
    const { service } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item({ quantityOrdered: '10.000' })],
    });

    const result = await service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '4' }] } as never, 'u1');

    expect((result as unknown as { status: string }).status).toBe(
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    );
  });

  // Omborga yoziladigan partiya buyurtma bandining TANNARXINI oladi —
  // aks holda FIFO hisobi noto'g'ri tannarx bilan yuritiladi.
  it('yangi partiya buyurtma bandidagi tannarx bilan yoziladi', async () => {
    const { service, stockService } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item({ unitCost: '2750.50' })],
    });

    await service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '3' }] } as never, 'u1');

    expect(stockService.receiveLot).toHaveBeenCalledWith(
      expect.objectContaining({
        stockItemId: 'si1',
        quantity: '3',
        unitCost: '2750.50',
        warehouseId: 'w1',
        purchaseOrderId: 'po1',
      }),
    );
  });

  // 🔴 YAXLITLASH TOLERANTLIGI. 0.1 uch marta qabul qilinganda
  // yig'indi 0.30000000000000004 bo'ladi — tolerantliksiz oxirgisi
  // "ortiqcha" deb rad etilardi.
  it("kasrli miqdorlarning ikkilik xatosi qabulni to'smaydi", async () => {
    const { service } = createService({
      status: PurchaseOrderStatus.APPROVED,
      items: [item({ quantityOrdered: '0.300', quantityReceived: '0.200' })],
    });

    await expect(
      service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '0.1' }] } as never, 'u1'),
    ).resolves.toBeDefined();
  });

  it.each([
    [PurchaseOrderStatus.DRAFT],
    [PurchaseOrderStatus.PENDING_APPROVAL],
    [PurchaseOrderStatus.RECEIVED],
    [PurchaseOrderStatus.CANCELLED],
  ])("%s holatidagi buyurtmani qabul qilib bo'lmaydi", async (status) => {
    const { service } = createService({ status, items: [item()] });
    await expect(
      service.receive('t1', 'p1', 'po1', { lines: [{ purchaseOrderItemId: 'poi1', quantityReceived: '1' }] } as never, 'u1'),
    ).rejects.toThrow(/qabul qilish mumkin/);
  });
});

describe('PurchaseOrdersService — tasdiqlash, rad etish, bekor qilish', () => {
  function createService(status: PurchaseOrderStatus) {
    const poEntity = { id: 'po1', status, items: [] };
    const poRepo = {
      findOne: jest.fn(() => Promise.resolve(poEntity)),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new PurchaseOrdersService(
      poRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, poEntity };
  }

  it('tasdiqlashda tasdiqlovchi va vaqt yoziladi', async () => {
    const { service } = createService(PurchaseOrderStatus.PENDING_APPROVAL);
    const po = (await service.approve('t1', 'p1', 'po1', 'boss')) as unknown as {
      status: string;
      approvedByUserId: string;
      approvedAt: Date;
    };
    expect(po.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(po.approvedByUserId).toBe('boss');
    expect(po.approvedAt).toBeInstanceOf(Date);
  });

  // 🔴 IKKI MARTA TASDIQLASH MUMKIN EMAS — aks holda tasdiqlovchi
  // nomi jimgina almashib ketardi va kim ruxsat berganini bilib
  // bo'lmasdi.
  it.each([
    [PurchaseOrderStatus.APPROVED],
    [PurchaseOrderStatus.RECEIVED],
    [PurchaseOrderStatus.REJECTED],
  ])('%s holatidagi buyurtmani qayta tasdiqlab bo\'lmaydi', async (status) => {
    const { service } = createService(status);
    await expect(service.approve('t1', 'p1', 'po1', 'boss')).rejects.toThrow(
      /tasdiqlash mumkin/,
    );
  });

  it('rad etishda ham mas\'ul va vaqt yoziladi', async () => {
    const { service } = createService(PurchaseOrderStatus.PENDING_APPROVAL);
    const po = (await service.reject('t1', 'p1', 'po1', 'boss')) as unknown as {
      status: string;
      approvedByUserId: string;
    };
    expect(po.status).toBe(PurchaseOrderStatus.REJECTED);
    expect(po.approvedByUserId).toBe('boss');
  });

  it.each([
    [PurchaseOrderStatus.DRAFT],
    [PurchaseOrderStatus.PENDING_APPROVAL],
    [PurchaseOrderStatus.APPROVED],
    [PurchaseOrderStatus.PARTIALLY_RECEIVED],
  ])('%s holatidagi buyurtmani bekor qilish mumkin', async (status) => {
    const { service } = createService(status);
    const po = (await service.cancel('t1', 'p1', 'po1')) as unknown as { status: string };
    expect(po.status).toBe(PurchaseOrderStatus.CANCELLED);
  });

  // 🔴 QABUL QILINGAN BUYURTMANI BEKOR QILIB BO'LMAYDI. Tovar
  // allaqachon omborda — bekor qilish hujjat bilan qoldiqni
  // bir-biriga zid qilib qo'yardi.
  it.each([
    [PurchaseOrderStatus.RECEIVED],
    [PurchaseOrderStatus.REJECTED],
    [PurchaseOrderStatus.CANCELLED],
  ])('%s holatidagi buyurtmani bekor qilib bo\'lmaydi', async (status) => {
    const { service } = createService(status);
    await expect(service.cancel('t1', 'p1', 'po1')).rejects.toThrow(/bekor qilib/);
  });
});
