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
