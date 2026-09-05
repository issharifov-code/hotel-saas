import { ReportsService } from './reports.service';

// `getBudgetPerformance` — "reja vs haqiqat". Bu yerda tekshiriladigan eng
// muhim narsa: haqiqiy ko'rsatkichlar `getOverview` bilan AYNAN bir xil
// ta'rifda hisoblanishi (daromad = totalAmount yig'indisi, ADR =
// daromad/kecha-xonalar, bandlik = kecha-xonalar/(xona×kun)), aks holda
// Dashboard'ning ikki joyida bir xil oy uchun turli raqam chiqardi.
//
// Vaqtga bog'liq mantiq (partial/future oylar) uchun soat qotirilgan.
describe('ReportsService.getBudgetPerformance', () => {
  const FIXED_NOW = new Date('2026-06-10T12:00:00.000Z'); // 2026-yil, 10-iyun

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function createService(opts: {
    totalRooms?: number;
    budgets?: {
      month: number;
      roomsRevenue: string | null;
      occupancyRatePct: string | null;
      adr: string | null;
    }[];
    bookings?: { checkIn: string; checkOut: string; totalAmount: string }[];
  }) {
    const roomRepo = {
      count: jest.fn().mockResolvedValue(opts.totalRooms ?? 0),
    };
    const bookingRepo = {
      find: jest.fn().mockResolvedValue(opts.bookings ?? []),
    };
    const budgetRepo = {
      find: jest.fn().mockResolvedValue(opts.budgets ?? []),
    };
    return new ReportsService(
      roomRepo as never,
      bookingRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      budgetRepo as never,
      // Maintenance repo — bu testlar getInsights'ni chaqirmaydi.
      { count: jest.fn().mockResolvedValue(0) } as never,
      // Tavsiya-yopish repo — xuddi shu sababdan bo'sh.
      { find: jest.fn().mockResolvedValue([]) } as never,
    );
  }

  it('12 oyni ham qaytaradi, budjet kiritilmagan oylar null bilan', async () => {
    const service = createService({ totalRooms: 10 });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.year).toBe(2026);
    expect(result.months).toHaveLength(12);
    expect(result.months[0].budget).toEqual({
      roomsRevenue: null,
      occupancyRatePct: null,
      adr: null,
    });
  });

  it("budjetni to'g'ri oyga bog'laydi va raqamga aylantiradi", async () => {
    const service = createService({
      totalRooms: 10,
      budgets: [
        {
          month: 3,
          roomsRevenue: '1000.00',
          occupancyRatePct: '65.00',
          adr: '400.00',
        },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[2].budget).toEqual({
      roomsRevenue: 1000,
      occupancyRatePct: 65,
      adr: 400,
    });
    // Boshqa oylarga tegmasligi kerak
    expect(result.months[1].budget.roomsRevenue).toBeNull();
  });

  it("qisman to'ldirilgan budjetda faqat kiritilgani raqam bo'ladi", async () => {
    const service = createService({
      totalRooms: 10,
      budgets: [
        { month: 1, roomsRevenue: '5000', occupancyRatePct: null, adr: null },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[0].budget).toEqual({
      roomsRevenue: 5000,
      occupancyRatePct: null,
      adr: null,
    });
  });

  it('haqiqiy daromad/ADR/bandlikni getOverview bilan bir xil hisoblaydi', async () => {
    // Yanvar (tugagan oy, 31 kun), 10 xona.
    // Ikkita bron: 2 kecha × 200 va 3 kecha × 300 = jami 5 kecha, 500 daromad.
    const service = createService({
      totalRooms: 10,
      bookings: [
        { checkIn: '2026-01-05', checkOut: '2026-01-07', totalAmount: '200' },
        { checkIn: '2026-01-10', checkOut: '2026-01-13', totalAmount: '300' },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);
    const yanvar = result.months[0];

    expect(yanvar.actual.roomsRevenue).toBe(500);
    expect(yanvar.actual.adr).toBe(100); // 500 / 5 kecha
    // 5 kecha / (10 xona × 31 kun) = 1.61%
    expect(yanvar.actual.occupancyRatePct).toBe(1.61);
  });

  it("bronni CHECK-IN oyiga bog'laydi (oy chegarasida ham)", async () => {
    // 31-yanvarda check-in, 2-fevralda check-out — daromad YANVARGA tegishli
    // (getOverview'dagi "davr ichida check-in qilgan" ta'rifi bilan bir xil).
    const service = createService({
      totalRooms: 10,
      bookings: [
        { checkIn: '2026-01-31', checkOut: '2026-02-02', totalAmount: '400' },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[0].actual.roomsRevenue).toBe(400); // yanvar
    expect(result.months[1].actual.roomsRevenue).toBe(0); // fevral
  });

  it('joriy oyni partial deb belgilaydi, kelajakdagilarni future', async () => {
    const service = createService({ totalRooms: 10 });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[4].isPartial).toBe(false); // may - tugagan
    expect(result.months[4].isFuture).toBe(false);
    expect(result.months[5].isPartial).toBe(true); // iyun - joriy
    expect(result.months[5].isFuture).toBe(false);
    expect(result.months[6].isFuture).toBe(true); // iyul - kelajak
  });

  it("joriy (tugamagan) oyda bandlik o'tgan kunlar bo'yicha hisoblanadi", async () => {
    // 10-iyun: 10 kun o'tgan. 5 kecha / (10 xona × 10 kun) = 5%.
    // Agar to'liq 30 kunga bo'linsa 1.67% chiqardi — ya'ni hali tugamagan oy
    // sun'iy ravishda past ko'rinardi.
    const service = createService({
      totalRooms: 10,
      bookings: [
        { checkIn: '2026-06-02', checkOut: '2026-06-07', totalAmount: '500' },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[5].actual.occupancyRatePct).toBe(5);
  });

  it('kelajakdagi yil uchun hammasi future, haqiqiy qiymatlar nol', async () => {
    const service = createService({ totalRooms: 10 });
    const result = await service.getBudgetPerformance('t1', 'p1', 2027);

    expect(result.months.every((m) => m.isFuture)).toBe(true);
    expect(result.months.every((m) => m.actual.roomsRevenue === 0)).toBe(true);
  });

  it("xona yo'q bo'lsa 0ga bo'lmaydi", async () => {
    const service = createService({
      totalRooms: 0,
      bookings: [
        { checkIn: '2026-01-05', checkOut: '2026-01-07', totalAmount: '200' },
      ],
    });
    const result = await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(result.months[0].actual.occupancyRatePct).toBe(0);
    expect(result.months[0].actual.adr).toBe(100); // ADR xonaga bog'liq emas
  });

  it("faqat so'ralgan tenant/mulk/yil budjetini o'qiydi", async () => {
    const budgetRepoFind = jest.fn().mockResolvedValue([]);
    const service = new ReportsService(
      { count: jest.fn().mockResolvedValue(0) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: budgetRepoFind } as never,
      { count: jest.fn().mockResolvedValue(0) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );

    await service.getBudgetPerformance('t1', 'p1', 2026);

    expect(budgetRepoFind).toHaveBeenCalledWith({
      where: { tenantId: 't1', propertyId: 'p1', year: 2026 },
    });
  });

  // 🔴 2026-09-05 (kod auditi): so'rov `Between(yearStart, nextYearStart)`
  // edi. SQL BETWEEN ikki tomondan inklyuziv, ya'ni KEYINGI yilning
  // 1-yanvari ham tushardi — va oy `checkIn.slice(5,7)` bilan olingani
  // uchun (yil tekshirilmasdan) u JORIY yilning yanvariga qo'shilardi.
  it("🔴 so'rov chegarasi joriy yil bilan tugaydi (1-yanvar ikki marta sanalmaydi)", async () => {
    const bookingRepoFind = jest.fn().mockResolvedValue([]);
    const service = new ReportsService(
      { count: jest.fn().mockResolvedValue(10) } as never,
      { find: bookingRepoFind } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { count: jest.fn().mockResolvedValue(0) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );

    await service.getBudgetPerformance('t1', 'p1', 2026);

    const where = bookingRepoFind.mock.calls[0][0].where;
    // TypeORM `Between` chegaralarini `_value` massivida saqlaydi.
    expect(where.checkIn._value).toEqual(['2026-01-01', '2026-12-31']);
  });
});
