import { ReportsService } from './reports.service';
import type { ReportsOverviewDto } from './reports.service';

// Tavsiyalar paneli qoidalari. `getInsights` `getOverview`ni ichki chaqiradi,
// shuning uchun bu yerda uni mock qilamiz — maqsad qoidalarni (chegaralar,
// jiddiylik darajasi, tartib, ruxsatga bog'liqlik) tekshirish, `getOverview`
// hisob-kitobini emas (uning o'z testlari bor).
describe('ReportsService.getInsights', () => {
  const FIXED_NOW = new Date('2026-06-10T12:00:00.000Z'); // oyning 10/30 kuni

  beforeAll(() => jest.useFakeTimers().setSystemTime(FIXED_NOW));
  afterAll(() => jest.useRealTimers());

  function baseOverview(over: Partial<ReportsOverviewDto> = {}) {
    return {
      asOfDate: '2026-06-10',
      periodDays: 30,
      occupancy: { totalRooms: 10, occupiedRooms: 5, occupancyRatePct: 50 },
      todayArrivals: 0,
      todayDepartures: 0,
      inHouseBookings: 0,
      adr: 400000,
      revPar: 200000,
      revenueTrend: [],
      occupancyTrend: [],
      adrTrend: [],
      outstandingInvoices: { count: 0, totalBalance: 0 },
      housekeepingPending: 0,
      loyaltyDistribution: [],
      trend: {
        occupancyRatePctDelta: null,
        adrDelta: null,
        revParDelta: null,
      },
      ...over,
    };
  }

  function createService(opts: {
    overview?: Partial<ReportsOverviewDto>;
    openTickets?: number;
    budgetMonths?: { month: number; roomsRevenue: string | null }[];
    // Foydalanuvchi avval yopgan tavsiyalar (`insight_dismissals` qatorlari).
    dismissals?: { insightId: string; severity: string }[];
  }) {
    const maintenanceRepo = {
      count: jest.fn().mockResolvedValue(opts.openTickets ?? 0),
    };
    const budgetRepo = {
      find: jest.fn().mockResolvedValue(
        (opts.budgetMonths ?? []).map((b) => ({
          month: b.month,
          roomsRevenue: b.roomsRevenue,
          occupancyRatePct: null,
          adr: null,
        })),
      ),
    };
    const dismissalRepo = {
      find: jest.fn().mockResolvedValue(opts.dismissals ?? []),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const service = new ReportsService(
      { count: jest.fn().mockResolvedValue(10) } as never,
      {
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      budgetRepo as never,
      maintenanceRepo as never,
      dismissalRepo as never,
    );
    jest
      .spyOn(service, 'getOverview')
      .mockResolvedValue(baseOverview(opts.overview));
    return service;
  }

  it("hech qanday signal bo'lmasa bo'sh ro'yxat qaytaradi", async () => {
    const service = createService({});
    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    expect(result).toEqual([]);
  });

  it("chegaradan past o'zgarish tavsiya chiqarmaydi (shovqin filtri)", async () => {
    const service = createService({
      overview: {
        trend: { occupancyRatePctDelta: 7, adrDelta: -8, revParDelta: null },
      },
    });
    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    expect(result).toEqual([]);
  });

  it('bandlik sezilarli pasaysa ogohlantirish chiqaradi', async () => {
    const service = createService({
      overview: {
        trend: {
          occupancyRatePctDelta: -18,
          adrDelta: null,
          revParDelta: null,
        },
      },
    });
    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    const it0 = result.find((i) => i.id === 'occupancy-trend');

    expect(it0?.severity).toBe('warning');
    expect(it0?.title).toContain('18%');
    // Tushuntirish aniq raqam bilan bo'lishi kerak — menejer tekshira olsin
    expect(it0?.detail).toContain('50%');
  });

  it("bandlik o'ssa bu ijobiy tavsiya (ogohlantirish emas)", async () => {
    const service = createService({
      overview: {
        trend: { occupancyRatePctDelta: 22, adrDelta: null, revParDelta: null },
      },
    });
    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    expect(result.find((i) => i.id === 'occupancy-trend')?.severity).toBe(
      'positive',
    );
  });

  it("to'lanmagan hisob-fakturalar haqida xabar beradi", async () => {
    const service = createService({
      overview: { outstandingInvoices: { count: 5, totalBalance: 1250000 } },
    });
    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    const inv = result.find((i) => i.id === 'outstanding-invoices');

    expect(inv?.title).toContain('5 ta');
    expect(inv?.actionTo).toBe('/invoicing');
  });

  it("tozalash navbati faqat xonalar soniga nisbatan katta bo'lsa chiqadi", async () => {
    // 10 xona, chegara 30% = 3. 2 ta vazifa — chiqmasligi kerak.
    const kam = createService({ overview: { housekeepingPending: 2 } });
    expect(
      (await kam.getInsights('t1', 'p1', 'u1', 30, true)).find(
        (i) => i.id === 'housekeeping-backlog',
      ),
    ).toBeUndefined();

    // 6 ta vazifa — chiqishi kerak.
    const kop = createService({ overview: { housekeepingPending: 6 } });
    expect(
      (await kop.getInsights('t1', 'p1', 'u1', 30, true)).find(
        (i) => i.id === 'housekeeping-backlog',
      ),
    ).toBeDefined();
  });

  it("ochiq texnik zayavkalar ko'p bo'lsa jiddiyligi oshadi", async () => {
    const oz = createService({ openTickets: 2 });
    expect(
      (await oz.getInsights('t1', 'p1', 'u1', 30, true)).find(
        (i) => i.id === 'open-maintenance',
      )?.severity,
    ).toBe('info');

    const kop = createService({ openTickets: 7 });
    expect(
      (await kop.getInsights('t1', 'p1', 'u1', 30, true)).find(
        (i) => i.id === 'open-maintenance',
      )?.severity,
    ).toBe('warning');
  });

  describe('budjetdan chetlanish', () => {
    // Iyun rejasi 3,000,000. Oyning 10/30 kuni o'tgan, ya'ni shu muddatga
    // kutilgan daromad 1,000,000.
    const budgetMonths = [{ month: 6, roomsRevenue: '3000000' }];

    it("reja o'tgan kunlar ulushiga moslashtiriladi (to'liq oyga emas)", async () => {
      // Haqiqiy 700,000 — kutilgan 1,000,000 dan 30% past.
      const service = createService({
        budgetMonths,
        overview: {},
      });
      jest.spyOn(service, 'getBudgetPerformance').mockResolvedValue({
        year: 2026,
        months: [
          {
            month: 6,
            budget: {
              roomsRevenue: 3000000,
              occupancyRatePct: null,
              adr: null,
            },
            actual: { roomsRevenue: 700000, occupancyRatePct: 0, adr: 0 },
            isPartial: true,
            isFuture: false,
          },
        ],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
      const b = result.find((i) => i.id === 'budget-variance');

      expect(b?.severity).toBe('critical');
      expect(b?.title).toContain('30%');
      // Agar to'liq oy rejasiga (3,000,000) solishtirilganda edi, chetlanish
      // ~77% chiqib, har oy boshida yolg'on ogohlantirish berardi.
      expect(b?.detail).toContain('10/30');
    });

    it("reja bajarilayotgan bo'lsa tavsiya chiqmaydi", async () => {
      const service = createService({ budgetMonths });
      jest.spyOn(service, 'getBudgetPerformance').mockResolvedValue({
        year: 2026,
        months: [
          {
            month: 6,
            budget: {
              roomsRevenue: 3000000,
              occupancyRatePct: null,
              adr: null,
            },
            actual: { roomsRevenue: 1020000, occupancyRatePct: 0, adr: 0 },
            isPartial: true,
            isFuture: false,
          },
        ],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
      expect(result.find((i) => i.id === 'budget-variance')).toBeUndefined();
    });

    it("accounting ruxsati bo'lmasa budjet tavsiyasi UMUMAN chiqmaydi", async () => {
      const service = createService({ budgetMonths });
      const spy = jest.spyOn(service, 'getBudgetPerformance');

      const result = await service.getInsights('t1', 'p1', 'u1', 30, false);

      expect(result.find((i) => i.id === 'budget-variance')).toBeUndefined();
      // Budjet umuman o'qilmasligi kerak — nafaqat javobdan olib tashlanishi
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("jiddiylik bo'yicha saralaydi — eng muhimi tepada", async () => {
    const service = createService({
      openTickets: 2, // info
      overview: {
        outstandingInvoices: { count: 3, totalBalance: 100 }, // warning
        trend: { occupancyRatePctDelta: 25, adrDelta: null, revParDelta: null }, // positive
      },
    });
    jest.spyOn(service, 'getBudgetPerformance').mockResolvedValue({
      year: 2026,
      months: [
        {
          month: 6,
          budget: { roomsRevenue: 3000000, occupancyRatePct: null, adr: null },
          actual: { roomsRevenue: 100000, occupancyRatePct: 0, adr: 0 },
          isPartial: true,
          isFuture: false,
        },
      ],
    });

    const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
    expect(result.map((i) => i.severity)).toEqual([
      'critical',
      'warning',
      'info',
      'positive',
    ]);
  });
});
