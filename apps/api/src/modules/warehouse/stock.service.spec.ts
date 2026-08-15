import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

interface LotRow {
  id: string;
  quantityRemaining: string;
  unitCost: string;
}

// Bu testlar StockService.issue — FIFO (birinchi kirgan, birinchi chiqadigan)
// chiqim mantig'ini sinaydi: eski partiyalar (lot) avval ishlatilishi, tannarx
// har bir partiyaning o'z narxi bo'yicha hisoblanishi, va yetarli zaxira
// bo'lmaganda operatsiya butunlay bekor qilinishi kerak.
describe('StockService.issue (FIFO)', () => {
  function createService(
    lots: { id: string; quantityRemaining: string; unitCost: string }[],
    options?: {
      stockItem?: { id: string; name: string; category: string | null } | null;
    },
  ) {
    const lotQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      // Testda lotlar allaqachon eng eski birinchi tartibda beriladi — real
      // so'rovda buni `orderBy('lot.received_at', 'ASC')` bajaradi.
      getMany: jest.fn().mockResolvedValue(lots.map((l) => ({ ...l }))),
    };
    const saveLots = jest.fn((rows: LotRow[]) => Promise.resolve(rows));
    const lotRepo = {
      createQueryBuilder: jest.fn(() => lotQueryBuilder),
      save: saveLots,
    };
    const transactionRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'txn-1', ...data }),
        ),
    };
    const stockItemRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue(
          options?.stockItem !== undefined
            ? options.stockItem
            : { id: 'item-1', name: 'Sochiq', category: null },
        ),
    };
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue(null),
    };

    const service = new StockService(
      lotRepo as never,
      transactionRepo as never,
      stockItemRepo as never,
      accountingService as never,
    );
    return { service, lotRepo, transactionRepo, accountingService };
  }

  it("bitta partiyadan yetarli bo'lsa, faqat o'sha partiyani kamaytiradi", async () => {
    const { service, lotRepo } = createService([
      { id: 'lot-1', quantityRemaining: '10', unitCost: '5.00' },
      { id: 'lot-2', quantityRemaining: '10', unitCost: '7.00' },
    ]);

    const result = await service.issue('t1', 'w1', {
      stockItemId: 'item-1',
      quantity: '4',
    });

    expect(result.quantity).toBe('4.000');
    expect(result.totalCost).toBe('20.00'); // 4 * 5.00 (faqat eng eski partiyadan)
    expect(result.unitCost).toBe('5.0000');

    const savedLots = lotRepo.save.mock.calls[0][0];
    expect(savedLots).toHaveLength(1);
    expect(savedLots[0].id).toBe('lot-1');
    expect(savedLots[0].quantityRemaining).toBe('6.000');
  });

  it("bitta partiya yetmasa, keyingi (eskiroq keyingi) partiyadan davom etadi va vaznli o'rtacha narxni hisoblaydi", async () => {
    const { service, lotRepo } = createService([
      { id: 'lot-1', quantityRemaining: '3', unitCost: '5.00' },
      { id: 'lot-2', quantityRemaining: '10', unitCost: '8.00' },
    ]);

    const result = await service.issue('t1', 'w1', {
      stockItemId: 'item-1',
      quantity: '5',
    });

    // lot-1: 3 dona * 5.00 = 15.00; lot-2: 2 dona * 8.00 = 16.00 -> jami 31.00
    expect(result.totalCost).toBe('31.00');
    expect(result.quantity).toBe('5.000');
    expect(Number(result.unitCost)).toBeCloseTo(31 / 5, 4);

    const savedLots = lotRepo.save.mock.calls[0][0];
    expect(savedLots).toHaveLength(2);
    expect(savedLots.find((l) => l.id === 'lot-1')?.quantityRemaining).toBe(
      '0.000',
    );
    expect(savedLots.find((l) => l.id === 'lot-2')?.quantityRemaining).toBe(
      '8.000',
    );
  });

  it("umumiy zaxira so'ralgan miqdordan kam bo'lsa, hech narsa saqlamay xato tashlaydi", async () => {
    const { service, lotRepo } = createService([
      { id: 'lot-1', quantityRemaining: '2', unitCost: '5.00' },
    ]);

    await expect(
      service.issue('t1', 'w1', {
        stockItemId: 'item-1',
        quantity: '10',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(lotRepo.save).not.toHaveBeenCalled();
  });

  it("so'ralgan miqdor musbat bo'lmasa xato tashlaydi", async () => {
    const { service } = createService([]);
    await expect(
      service.issue('t1', 'w1', {
        stockItemId: 'item-1',
        quantity: '0',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('tovar topilmasa NotFoundException tashlaydi', async () => {
    const { service, lotRepo } = createService(
      [{ id: 'lot-1', quantityRemaining: '10', unitCost: '5.00' }],
      {
        stockItem: null,
      },
    );
    await expect(
      service.issue('t1', 'w1', {
        stockItemId: 'missing',
        quantity: '1',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(lotRepo.save).not.toHaveBeenCalled();
  });
});
