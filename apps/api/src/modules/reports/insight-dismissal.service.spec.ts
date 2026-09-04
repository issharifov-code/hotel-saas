import { ReportsService } from './reports.service';
import type { ReportsOverviewDto } from './reports.service';

// Tavsiyani "e'tiborga oldim" deb yopish.
//
// Bu yerdagi eng muhim xatti-harakat — yopish ABADIY EMAS. Ikki yo'l bilan
// bekor bo'ladi: (1) bir hafta o'tsa, (2) holat yomonlashsa. Ikkalasi ham
// ataylab: yopilgan haqiqiy muammo ko'zdan butunlay yo'qolmasligi kerak.
describe('ReportsService — tavsiyani yopish', () => {
  const FIXED_NOW = new Date('2026-06-10T12:00:00.000Z');

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
      trend: { occupancyRatePctDelta: null, adrDelta: null, revParDelta: null },
      ...over,
    };
  }

  function createService(
    opts: {
      overview?: Partial<ReportsOverviewDto>;
      openTickets?: number;
      dismissals?: { insightId: string; severity: string }[];
      existingRow?: Record<string, unknown> | null;
    } = {},
  ) {
    const dismissalRepo = {
      find: jest.fn().mockResolvedValue(opts.dismissals ?? []),
      findOne: jest.fn().mockResolvedValue(opts.existingRow ?? null),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
      { find: jest.fn().mockResolvedValue([]) } as never,
      { count: jest.fn().mockResolvedValue(opts.openTickets ?? 0) } as never,
      dismissalRepo as never,
    );
    jest
      .spyOn(service, 'getOverview')
      .mockResolvedValue(baseOverview(opts.overview));
    return { service, dismissalRepo };
  }

  describe('yopilganlarni belgilash', () => {
    it('yopilgan tavsiya javobdan OLIB TASHLANMAYDI, faqat belgilanadi', async () => {
      // Frontend "N ta yopilgan · Ko'rsatish" havolasini chiza olishi uchun
      // ro'yxatni bilishi kerak. Shu sababdan filtrlash serverda emas.
      const { service } = createService({
        openTickets: 2, // 'open-maintenance', info
        dismissals: [{ insightId: 'open-maintenance', severity: 'info' }],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
      const item = result.find((i) => i.id === 'open-maintenance');

      expect(item).toBeDefined();
      expect(item?.dismissed).toBe(true);
    });

    it('yopilmagan tavsiya belgilanmaydi', async () => {
      const { service } = createService({ openTickets: 2 });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);

      expect(
        result.find((i) => i.id === 'open-maintenance')?.dismissed,
      ).toBeUndefined();
    });

    it("🔴 holat YOMONLASHSA yopish bekor bo'ladi", async () => {
      // 2 ta zayavka (info) yopilgan edi; endi 7 ta — bu `warning`.
      // Bu YANGI xabar, eski yopish bilan yashirilmasligi kerak.
      const { service } = createService({
        openTickets: 7,
        dismissals: [{ insightId: 'open-maintenance', severity: 'info' }],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);
      const item = result.find((i) => i.id === 'open-maintenance');

      expect(item?.severity).toBe('warning');
      expect(item?.dismissed).toBeUndefined();
    });

    it('holat YAXSHILANSA yopilganicha qoladi', async () => {
      // 7 ta (warning) yopilgan edi, endi 2 ta (info) — muammo kichraydi,
      // qayta bezovta qilishga hojat yo'q.
      const { service } = createService({
        openTickets: 2,
        dismissals: [{ insightId: 'open-maintenance', severity: 'warning' }],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);

      expect(result.find((i) => i.id === 'open-maintenance')?.dismissed).toBe(
        true,
      );
    });

    it("noma'lum daraja saqlangan bo'lsa tavsiya KO'RSATILADI", async () => {
      // Xatoga qarab yashirmaslik tarafida turamiz — yashirib qo'yish
      // ko'rsatib yuborishdan xavfliroq.
      const { service } = createService({
        openTickets: 2,
        dismissals: [{ insightId: 'open-maintenance', severity: 'ajabtovur' }],
      });

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);

      expect(
        result.find((i) => i.id === 'open-maintenance')?.dismissed,
      ).toBeUndefined();
    });

    it("faqat SHU foydalanuvchining, shu mulkdagi, muddati o'tmagan yopishlari o'qiladi", async () => {
      const { service, dismissalRepo } = createService({ openTickets: 2 });

      await service.getInsights('t1', 'p1', 'u1', 30, true);

      // `.mock.calls` — `any[][]`, shuning uchun kutilgan shaklni aniq
      // e'lon qilamiz (aks holda butun tekshiruv tipsiz bo'lib qolardi).
      type FindArg = {
        where: {
          tenantId: string;
          propertyId: string;
          userId: string;
          // MoreThan(...) — TypeORM FindOperator, qiymati `value` ichida.
          dismissedAt: { value: Date };
        };
      };
      const calls = dismissalRepo.find.mock.calls as unknown as FindArg[][];
      const where = calls[0][0].where;
      expect(where.tenantId).toBe('t1');
      expect(where.propertyId).toBe('p1');
      expect(where.userId).toBe('u1');
      const since = where.dismissedAt.value;
      expect(FIXED_NOW.getTime() - since.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it("tavsiya bo'lmasa bazaga umuman murojaat qilinmaydi", async () => {
      const { service, dismissalRepo } = createService({});

      const result = await service.getInsights('t1', 'p1', 'u1', 30, true);

      expect(result).toEqual([]);
      expect(dismissalRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('dismissInsight', () => {
    it('yangi yopish qatorini yaratadi', async () => {
      const { service, dismissalRepo } = createService({ existingRow: null });

      await service.dismissInsight(
        't1',
        'p1',
        'u1',
        'open-maintenance',
        'info',
      );

      expect(dismissalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          propertyId: 'p1',
          userId: 'u1',
          insightId: 'open-maintenance',
          severity: 'info',
        }),
      );
      expect(dismissalRepo.save).toHaveBeenCalled();
    });

    it('qayta yopilganda YANGI qator emas, mavjudi yangilanadi', async () => {
      // UNIQUE (user, property, insight) buzilmasligi uchun — va yopish
      // muddati noldan boshlanishi uchun.
      const existingRow = {
        id: 'd1',
        severity: 'info',
        dismissedAt: new Date('2026-06-01T00:00:00.000Z'),
      };
      const { service, dismissalRepo } = createService({ existingRow });

      await service.dismissInsight(
        't1',
        'p1',
        'u1',
        'open-maintenance',
        'warning',
      );

      expect(dismissalRepo.create).not.toHaveBeenCalled();
      expect(existingRow.severity).toBe('warning');
      expect(existingRow.dismissedAt).toEqual(FIXED_NOW);
      expect(dismissalRepo.save).toHaveBeenCalledWith(existingRow);
    });
  });

  describe('restoreInsights', () => {
    it('bitta tavsiyani qaytaradi', async () => {
      const { service, dismissalRepo } = createService();

      await service.restoreInsights('t1', 'p1', 'u1', 'open-maintenance');

      expect(dismissalRepo.delete).toHaveBeenCalledWith({
        tenantId: 't1',
        propertyId: 'p1',
        userId: 'u1',
        insightId: 'open-maintenance',
      });
    });

    it('insightId berilmasa faqat SHU foydalanuvchining hammasini qaytaradi', async () => {
      const { service, dismissalRepo } = createService();

      await service.restoreInsights('t1', 'p1', 'u1');

      // `userId` shartsiz o'chirish butun mehmonxonaning yopishlarini
      // tozalab yuborardi — shuning uchun u albatta bo'lishi kerak.
      expect(dismissalRepo.delete).toHaveBeenCalledWith({
        tenantId: 't1',
        propertyId: 'p1',
        userId: 'u1',
      });
    });
  });
});
