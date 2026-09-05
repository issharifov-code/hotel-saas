import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

interface LotRow {
  id: string;
  quantityRemaining: string;
  unitCost: string;
  bookedCostRemaining?: string;
}

// Bu testlar StockService.issue — FIFO (birinchi kirgan, birinchi chiqadigan)
// chiqim mantig'ini sinaydi: eski partiyalar (lot) avval ishlatilishi, tannarx
// har bir partiyaning o'z narxi bo'yicha hisoblanishi, va yetarli zaxira
// bo'lmaganda operatsiya butunlay bekor qilinishi kerak.
describe('StockService.issue (FIFO)', () => {
  function createService(
    lots: LotRow[],
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
      // 2026-09-05: partiya endi bosh kitobga yozilgan qiymatini ham olib
      // yuradi. Sinovda ko'rsatilmagan bo'lsa, migratsiyadagi backfill bilan
      // bir xil qoida — miqdor × narx, 2 xonagacha.
      getMany: jest.fn().mockResolvedValue(
        lots.map((l) => ({
          bookedCostRemaining: (
            Number(l.quantityRemaining) * Number(l.unitCost)
          ).toFixed(2),
          ...l,
        })),
      ),
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

  // 🔴 2026-09-05 (kod auditi): `unit_cost` 4 xonali, provodkalar esa 2
  // xonali. Kirim BIR MARTA yaxlitlanardi, chiqim esa HAR SAFAR alohida —
  // natijada partiya butunlay tugagach ham `inventory` hisobida tiyin
  // qoldig'i osilib qolardi va ombor hisoboti bosh kitob bilan
  // tenglashmasdi.
  it('🔴 partiya birma-bir tugatilganda chiqimlar yig\'indisi kirimga AYNAN teng', async () => {
    // 7 dona × 12 345,6789 -> kirimda 86 419,75 debetlanadi
    // (aniq qiymat 86 419,7523).
    const kirim = Number((7 * 12345.6789).toFixed(2));
    expect(kirim).toBe(86419.75);

    let qoldiqMiqdor = 7;
    let qoldiqQiymat = kirim;
    let chiqimlarYigindisi = 0;

    // Har safar 1 donadan chiqaramiz — eng yomon holat.
    for (let i = 0; i < 7; i++) {
      const { service, accountingService } = createService([
        {
          id: 'lot-1',
          quantityRemaining: String(qoldiqMiqdor),
          unitCost: '12345.6789',
          bookedCostRemaining: qoldiqQiymat.toFixed(2),
        },
      ]);

      const result = await service.issue(
        't1',
        'w1',
        { stockItemId: 'item-1', quantity: '1' },
        null,
        { propertyId: 'p1' },
      );

      chiqimlarYigindisi += Number(result.totalCost);
      // Provodka ham xuddi shu summa bilan ketadi.
      expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
        expect.objectContaining({ creditSystemKey: 'inventory' }),
      );

      qoldiqMiqdor -= 1;
      qoldiqQiymat = Number(
        (qoldiqQiymat - Number(result.totalCost)).toFixed(2),
      );
    }

    // Eng muhimi: partiya tugadi va bosh kitobda hech narsa osilib qolmadi.
    expect(qoldiqMiqdor).toBe(0);
    expect(qoldiqQiymat).toBe(0);
    expect(Number(chiqimlarYigindisi.toFixed(2))).toBe(kirim);
  });

  // Yuqoridagi holatda yaxlitlash YUQORIGA ketadi (chiqimlar yig'indisi
  // kirimdan oshib ketardi). Teskari yo'nalish ham bo'ladi — yaxlitlash
  // PASTGA ketsa, partiya tugagach uning qiymati kitobda OSILIB QOLARDI.
  // Aynan shu holat "to'liq tugadi -> qoldiqning hammasini ol" tarmog'isiz
  // tuzalmaydi.
  it("🔴 yaxlitlash pastga ketganda ham partiya qiymati to'liq yopiladi", async () => {
    // 3 dona × 1,114 -> kirimda round2(3,342) = 3,34 debetlanadi.
    // Har chiqim alohida: round2(1,114) = 1,11; uchtasi = 3,33 -> 0,01
    // partiyada osilib qolardi.
    let qoldiqMiqdor = 3;
    let qoldiqQiymat = 3.34;
    let yigindi = 0;

    for (let i = 0; i < 3; i++) {
      const { service } = createService([
        {
          id: 'lot-1',
          quantityRemaining: String(qoldiqMiqdor),
          unitCost: '1.1140',
          bookedCostRemaining: qoldiqQiymat.toFixed(2),
        },
      ]);
      const result = await service.issue('t1', 'w1', {
        stockItemId: 'item-1',
        quantity: '1',
      });
      yigindi += Number(result.totalCost);
      qoldiqMiqdor -= 1;
      qoldiqQiymat = Number((qoldiqQiymat - Number(result.totalCost)).toFixed(2));
    }

    expect(qoldiqMiqdor).toBe(0);
    // Partiyada bir tiyin ham qolmasligi kerak.
    expect(qoldiqQiymat).toBe(0);
    expect(Number(yigindi.toFixed(2))).toBe(3.34);
  });

  it("partiya to'liq tugamasa, ulush odatiy yaxlitlash bilan olinadi", async () => {
    const { service } = createService([
      {
        id: 'lot-1',
        quantityRemaining: '10',
        unitCost: '3.3333',
        bookedCostRemaining: '33.33',
      },
    ]);

    const result = await service.issue('t1', 'w1', {
      stockItemId: 'item-1',
      quantity: '3',
    });

    // 3 × 3.3333 = 9.9999 -> 10.00
    expect(result.totalCost).toBe('10.00');
  });
});
