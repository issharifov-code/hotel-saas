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

// 🔬 KIRIM VA INVENTARIZATSIYA TUZATISHI (2026-09-05).
//
// NIMA UCHUN QO'SHILDI. Qoplama o'lchovida `stock.service.ts` 62.5%
// edi va qoplanmagan qismning asosiysi — `receiveLot` ning moliyaviy
// shoxi hamda `adjust` (inventarizatsiya tuzatishi). Ikkalasi ham
// OMBOR QOLDIG'IGA VA BOSH KITOBGA bir vaqtda ta'sir qiladi.
//
// `adjust` da ikki yo'nalish bor va ular butunlay boshqacha ishlaydi:
//
//   MUSBAT (ortiqcha topildi) — yangi partiya sifatida qo'shiladi,
//   narxi 0. Nol narx ataylab: bu tovar hech qanday pulga sotib
//   olinmagan, ya'ni uni aktiv sifatida baholash kitobni shishirardi.
//
//   MANFIY (yo'qotish, o'g'irlik, buzilish) — FIFO bo'yicha yechiladi,
//   lekin "iste'mol" emas, "TANQISLIK" xarajati sifatida provodka
//   qilinadi. Farqi muhim: iste'mol normal xarajat, tanqislik esa
//   nazorat muammosining belgisi va alohida hisobda ko'rinishi kerak.
describe('StockService.adjust — inventarizatsiya tuzatishi', () => {
  function createService(lots: LotRow[] = [{ id: 'lot-1', quantityRemaining: '10', unitCost: '5.00' }]) {
    const lotQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(
        lots.map((l) => ({
          bookedCostRemaining: (Number(l.quantityRemaining) * Number(l.unitCost)).toFixed(2),
          ...l,
        })),
      ),
    };
    const lotRepo = {
      createQueryBuilder: jest.fn(() => lotQueryBuilder),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((row: unknown) =>
        Promise.resolve(Array.isArray(row) ? row : { id: 'lot-yangi', ...(row as object) }),
      ),
    };
    const transactionRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) => Promise.resolve({ id: 'txn-1', ...(data as object) })),
    };
    const stockItemRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'item-1', name: 'Sochiq', category: null }),
    };
    const accountingService = { postSimpleEntry: jest.fn().mockResolvedValue(null) };
    const service = new StockService(
      lotRepo as never,
      transactionRepo as never,
      stockItemRepo as never,
      accountingService as never,
    );
    return { service, lotRepo, transactionRepo, accountingService };
  }

  // 📌 XABAR MATNI ATAYLAB TEKSHIRILADI. Faqat `BadRequestException`
  // turini tekshirish YETARLI EMAS: mutatsion sinovda `qty === 0`
  // qo'riqchisi butunlay olib tashlanganda ham test yashil qolgan edi
  // — nol miqdor pastdagi `issue()` ga tushib, u yerdagi "Chiqim
  // miqdori musbat bo'lishi kerak" xatosini bergan. Ya'ni test
  // qo'riqchini emas, umuman "biror xato bo'ldi" ni tasdiqlardi.
  // Aniq matn talab qilinganda mutatsiya endi ushlanadi.
  it("nol miqdorli tuzatish o'z xabari bilan rad etiladi", async () => {
    const { service, transactionRepo } = createService();
    await expect(
      service.adjust('t1', 'w1', { stockItemId: 'item-1', quantity: '0' } as never),
    ).rejects.toThrow(/Tuzatish miqdori 0/);
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  // 🔴 ORTIQCHA TOPILGAN TOVAR NOL NARX BILAN KIRITILADI. Aks holda
  // hech qanday pulga olinmagan tovar aktiv sifatida baholanib,
  // balansni shishirardi.
  it("musbat tuzatish yangi partiyani nol narx bilan qo'shadi", async () => {
    const { service, lotRepo, transactionRepo } = createService();

    const txn = await service.adjust(
      't1',
      'w1',
      { stockItemId: 'item-1', quantity: '7', reason: 'inventarizatsiya ortig\'i' } as never,
      'u1',
      'p1',
    );

    expect(lotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ quantityReceived: '7.000', unitCost: '0', bookedCostRemaining: '0.00' }),
    );
    expect((txn as unknown as { type: string }).type).toBe('adjustment');
    expect((txn as unknown as { referenceType: string }).referenceType).toBe('inventory_adjustment');
    expect(transactionRepo.save).toHaveBeenCalled();
  });

  // 🔴 MANFIY TUZATISH — FIFO bo'yicha yechiladi va miqdor MANFIY
  // ko'rinishda yoziladi (tarixda "chiqim" ekani ko'rinib tursin).
  it('manfiy tuzatish FIFO bo\'yicha yechadi va manfiy miqdor bilan yoziladi', async () => {
    const { service, lotRepo } = createService([
      { id: 'lot-1', quantityRemaining: '10', unitCost: '5.00' },
    ]);

    const txn = (await service.adjust(
      't1',
      'w1',
      { stockItemId: 'item-1', quantity: '-4', reason: 'buzilgan' } as never,
      'u1',
      'p1',
    )) as unknown as { quantity: string; type: string; referenceType: string };

    expect(txn.quantity).toBe('-4.000');
    expect(txn.type).toBe('adjustment');
    expect(txn.referenceType).toBe('inventory_adjustment');
    // Partiya haqiqatan kamaytirilgan bo'lishi kerak.
    const savedLots = lotRepo.save.mock.calls.find((c) => Array.isArray(c[0]))?.[0] as LotRow[];
    expect(savedLots[0].quantityRemaining).toBe('6.000');
  });

  it("zaxira yetmasa manfiy tuzatish butunlay rad etiladi", async () => {
    const { service } = createService([{ id: 'lot-1', quantityRemaining: '2', unitCost: '5.00' }]);
    await expect(
      service.adjust('t1', 'w1', { stockItemId: 'item-1', quantity: '-9' } as never, 'u1', 'p1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('StockService.receiveLot — moliyaviy provodka', () => {
  function createService() {
    const lotRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((row: unknown) => Promise.resolve({ id: 'lot-1', ...(row as object) })),
    };
    const transactionRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) => Promise.resolve({ id: 'txn-1', ...(data as object) })),
    };
    const accountingService = { postSimpleEntry: jest.fn().mockResolvedValue(null) };
    const service = new StockService(
      lotRepo as never,
      transactionRepo as never,
      { findOneBy: jest.fn() } as never,
      accountingService as never,
    );
    return { service, lotRepo, transactionRepo, accountingService };
  }

  const base = {
    tenantId: 't1',
    warehouseId: 'w1',
    stockItemId: 'item-1',
    quantity: '4.000',
    unitCost: '2500.00',
  };

  it("partiya kitobdagi qiymatini o'zi bilan olib yuradi", async () => {
    const { service, lotRepo } = createService();
    await service.receiveLot(base);
    expect(lotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ bookedCostRemaining: '10000.00', quantityRemaining: '4.000' }),
    );
  });

  // 🔴 PROVODKA FAQAT HAQIQIY XARID UCHUN. Qo'lda kirim yoki
  // inventarizatsiya ortig'i (narxi 0) kitobga yozilmasligi kerak —
  // aks holda "havodan" aktiv va kreditorlik qarzi paydo bo'lardi.
  it('xarid buyurtmasisiz kirimda provodka yozilmaydi', async () => {
    const { service, accountingService } = createService();
    await service.receiveLot({ ...base, propertyId: 'p1' });
    expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
  });

  it('xarid buyurtmasi bilan kirimda zaxira va kreditorlik qarzi provodkasi yoziladi', async () => {
    const { service, accountingService } = createService();
    await service.receiveLot({ ...base, propertyId: 'p1', purchaseOrderId: 'po-1' });
    expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        debitSystemKey: 'inventory',
        creditSystemKey: 'accounts_payable',
        amount: '10000.00',
      }),
    );
  });

  // Mulk berilmasa provodka yozib bo'lmaydi (bosh kitob mulk
  // darajasida yuritiladi) — bu holat jim o'tishi kerak, xato emas.
  it("mulk berilmasa provodka yozilmaydi", async () => {
    const { service, accountingService } = createService();
    await service.receiveLot({ ...base, purchaseOrderId: 'po-1' });
    expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
  });
});
