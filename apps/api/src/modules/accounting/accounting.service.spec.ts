import { BadRequestException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

// Bu testlar AccountingService.postJournalEntry — buxgalteriya tizimining eng
// muhim invarianti — ikki tomonlama yozuv qoidasini (debet jami = kredit jami,
// har bir qator faqat bittasiga ega) tekshiradi. Haqiqiy DB o'rniga qatorlar
// bazaga yozilishidan OLDIN sodir bo'ladigan validatsiya xatolarini sinaydi —
// shuning uchun repo'lar to'liq real bo'lishi shart emas, faqat muvaffaqiyatli
// holat uchun minimal mock kifoya.
describe('AccountingService.postJournalEntry', () => {
  function createService() {
    // manager.getRepository(...) faqat muvaffaqiyatli (balanslangan) holatda
    // chaqiriladi — create/save'ni chain qiladigan minimal mock.
    const fakeLineRepo = { create: (l: unknown) => l };
    const savedEntry = { id: 'entry-1' };
    const fakeEntryRepo: {
      create: (data: unknown) => unknown;
      save: jest.Mock;
      manager: { getRepository: jest.Mock };
    } = {
      create: (data: unknown) => data,
      save: jest.fn().mockResolvedValue(savedEntry),
      manager: { getRepository: jest.fn() },
    };
    // postJournalEntry ichida ham entryRepo, ham lineRepo manager.getRepository
    // orqali olinadi — ikkalasi ham entryRepo.manager'dan keladi (real kodda
    // bir xil so'rov-transaction manager'i). JournalEntry uchun entryRepo'ning
    // o'zi kerak (create+save), boshqa har qanday entity (JournalEntryLine) uchun
    // fakeLineRepo qaytariladi.
    fakeEntryRepo.manager.getRepository.mockImplementation(
      (entity: unknown) => {
        if ((entity as { name?: string })?.name === 'JournalEntry')
          return fakeEntryRepo;
        return fakeLineRepo;
      },
    );

    // 🔴 2026-09-05 (audit): postJournalEntry endi har bir qatordagi
    // `accountId` shu tenantga tegishli ekanini tekshiradi (FK tekshiruvi
    // RLS'ni chetlab o'tadi, ya'ni begona hisob UUID'i bilan qator
    // yozilib, keyin hisobotlardan jimgina yo'qolardi).
    const accountRepo = {
      manager: {
        getRepository: jest.fn().mockReturnValue({
          // Sinovdagi barcha qatorlar shu tenantniki deb qabul qilinadi.
          count: jest.fn().mockImplementation(({ where }) => {
            const ids = where.id?._value ?? [];
            return Promise.resolve(ids.length);
          }),
        }),
      },
    } as never;
    const lineRepo = {} as never;
    const service = new AccountingService(
      accountRepo,
      fakeEntryRepo as never,
      lineRepo,
    );
    return { service, fakeEntryRepo };
  }

  const baseInput = {
    tenantId: 't1',
    propertyId: 'p1',
    description: 'Test yozuvi',
    sourceModule: 'manual' as const,
  };

  it("kamida 2 qatordan kam bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [{ accountId: 'a1', debit: '100' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("bitta qatorda ham debet, ham kredit bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '100', credit: '50' },
          { accountId: 'a2', credit: '100' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("bitta qatorda debet ham, kredit ham 0 bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '0', credit: '0' },
          { accountId: 'a2', credit: '100' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("manfiy summa bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '-10' },
          { accountId: 'a2', credit: '10' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("debet jami kredit jamiga teng bo'lmasa xato tashlaydi (balanslanmagan)", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '100' },
          { accountId: 'a2', credit: '99.5' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("debet jami = kredit jami bo'lsa yozuvni muvaffaqiyatli saqlaydi", async () => {
    const { service, fakeEntryRepo } = createService();
    const result = await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '150.00' },
        { accountId: 'a2', credit: '150.00' },
      ],
    });
    expect(result).toEqual({ id: 'entry-1' });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });

  it('uch qatorli (bitta debet, ikkita kredit) balanslangan yozuvni qabul qiladi', async () => {
    const { service, fakeEntryRepo } = createService();
    await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '100' },
        { accountId: 'a2', credit: '60' },
        { accountId: 'a3', credit: '40' },
      ],
    });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });

  it('kichik yaxlitlash xatosi (<=0.005) tolerantlik doirasida qabul qilinadi', async () => {
    const { service, fakeEntryRepo } = createService();
    await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '100.004' },
        { accountId: 'a2', credit: '100.00' },
      ],
    });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });

  // 🔴 2026-09-05 (kod auditi): `accountId` shu tenantga tegishli ekani
  // tekshirilmasdi. FK tekshiruvi RLS'ni chetlab o'tadi, ya'ni begona
  // tenantning hisob UUID'i bilan qator YOZILARDI, keyin hisobotlar
  // `innerJoin account` qilgani uchun RLS uni chiqarib tashlar va yozuv
  // kitoblardan jimgina yo'qolardi.
  it("qator hisobi shu tenantda topilmasa yozuv rad etiladi", async () => {
    const fakeLineRepo = { create: (d: unknown) => d };
    const fakeEntryRepo: {
      create: (data: unknown) => unknown;
      save: jest.Mock;
      manager: { getRepository: jest.Mock };
    } = {
      create: (d: unknown) => d,
      save: jest.fn(),
      manager: { getRepository: jest.fn() },
    };
    fakeEntryRepo.manager.getRepository.mockImplementation((e: unknown) =>
      (e as { name?: string })?.name === 'JournalEntry' ? fakeEntryRepo : fakeLineRepo,
    );
    const accountRepo = {
      manager: {
        getRepository: jest.fn().mockReturnValue({
          // Ikkita ID so'ralgan, bazada faqat bittasi shu tenantniki.
          count: jest.fn().mockResolvedValue(1),
        }),
      },
    } as never;

    const service = new AccountingService(
      accountRepo,
      fakeEntryRepo as never,
      {} as never,
    );

    await expect(
      service.postJournalEntry({
        tenantId: 't1',
        propertyId: 'p1',
        description: 'Qo\'lda yozuv',
        sourceModule: 'manual',
        lines: [
          { accountId: 'oz-hisobim', debit: '100.00' },
          { accountId: 'begona-tenant-hisobi', credit: '100.00' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(fakeEntryRepo.save).not.toHaveBeenCalled();
  });
});

// 🔬 `postSimpleEntry` — IKKI QATORLI YOZUVNING YO'NALISHI (2026-09-05).
//
// NIMA UCHUN QO'SHILDI. Qoplama o'lchovida `accounting.service.ts`
// 46% edi va qoplanmagan qismning eng qimmatli bo'lagi shu metod:
// butun tizimdagi HAR BIR moliyaviy harakat (to'lov, xona narxi,
// POS buyurtmasi, ombor chiqimi, maosh) oxir-oqibat shu yerdan
// o'tadi.
//
// Ikki nozik qoida bor va ikkalasi ham test bilan qo'riqlanmagan edi:
//
//   1. NOLGA YAQIN SUMMA — yozuv umuman yozilmaydi (`null`). Bepul
//      namuna yoki 0-narxli tuzatish uchun bo'sh provodka ochish
//      kitobni faqat ifloslantiradi.
//
//   2. MANFIY SUMMA — debet va kredit ALMASHADI. Masalan xona narxi
//      keyin kamaytirilsa, tuzatish "teskari" yo'nalishda yozilishi
//      kerak. Almashish bo'lmasa daromad kamayish o'rniga OSHARDI.
describe('AccountingService.postSimpleEntry — yo\'nalish va nol summa', () => {
  function createService() {
    const accounts: Record<string, { id: string }> = {
      guest_ledger_ar: { id: 'acc-ar' },
      room_revenue: { id: 'acc-revenue' },
    };
    const accountRepo = {
      findOne: jest.fn(({ where }: { where: { systemKey: string } }) =>
        Promise.resolve(accounts[where.systemKey] ?? null),
      ),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          count: jest.fn().mockImplementation(({ where }) =>
            Promise.resolve((where.id?._value ?? []).length),
          ),
        }),
      },
    };
    const fakeLineRepo = { create: (l: unknown) => l };
    const fakeEntryRepo: Record<string, unknown> = {
      create: (data: unknown) => data,
      save: jest.fn((entry: unknown) => Promise.resolve(entry)),
    };
    fakeEntryRepo.manager = {
      getRepository: jest.fn((entity: unknown) =>
        (entity as { name?: string })?.name === 'JournalEntry' ? fakeEntryRepo : fakeLineRepo,
      ),
    };
    const service = new AccountingService(
      accountRepo as never,
      fakeEntryRepo as never,
      {} as never,
    );
    return { service, fakeEntryRepo, accountRepo };
  }

  const base = {
    tenantId: 't1',
    propertyId: 'p1',
    description: 'Xona narxi',
    sourceModule: 'invoicing' as const,
    debitSystemKey: 'guest_ledger_ar',
    creditSystemKey: 'room_revenue',
  };

  it("musbat summada debet va kredit berilgan tartibda yoziladi", async () => {
    const { service } = createService();
    const entry = (await service.postSimpleEntry({ ...base, amount: '150000' })) as unknown as {
      lines: { accountId: string; debit: string; credit: string }[];
    };

    expect(entry.lines).toEqual([
      expect.objectContaining({ accountId: 'acc-ar', debit: '150000.00', credit: '0.00' }),
      expect.objectContaining({ accountId: 'acc-revenue', debit: '0.00', credit: '150000.00' }),
    ]);
  });

  // 🔴 MANFIY SUMMA — YO'NALISH TESKARI. Almashish bo'lmasa,
  // narx kamaytirilganda daromad kamayish o'rniga oshib ketardi.
  it('manfiy summada debet va kredit almashadi', async () => {
    const { service } = createService();
    const entry = (await service.postSimpleEntry({ ...base, amount: '-40000' })) as unknown as {
      lines: { accountId: string; debit: string; credit: string }[];
    };

    expect(entry.lines).toEqual([
      expect.objectContaining({ accountId: 'acc-revenue', debit: '40000.00', credit: '0.00' }),
      expect.objectContaining({ accountId: 'acc-ar', debit: '0.00', credit: '40000.00' }),
    ]);
  });

  it.each(['0', '0.004', '-0.004'])(
    "nolga yaqin summa (%s) uchun umuman yozuv ochilmaydi",
    async (amount) => {
      const { service, fakeEntryRepo } = createService();
      const result = await service.postSimpleEntry({ ...base, amount });
      expect(result).toBeNull();
      expect(fakeEntryRepo.save).not.toHaveBeenCalled();
    },
  );

  // Chegaraning narigi tomoni: bir tiyin ham yozilishi kerak.
  it("bir tiyinlik summa ham yoziladi", async () => {
    const { service, fakeEntryRepo } = createService();
    await service.postSimpleEntry({ ...base, amount: '0.01' });
    expect(fakeEntryRepo.save).toHaveBeenCalled();
  });

  // Hisoblar rejasida tizim hisobi topilmasa — bu sozlash xatosi,
  // va u JIM O'TMASLIGI kerak: aks holda operatsiya "muvaffaqiyatli"
  // ko'rinadi, lekin kitobda izi qolmaydi.
  it("tizim hisobi topilmasa aniq xato beriladi", async () => {
    const { service } = createService();
    await expect(
      service.postSimpleEntry({ ...base, creditSystemKey: 'yoq_hisob', amount: '100' }),
    ).rejects.toThrow(/topilmadi/);
  });
});
