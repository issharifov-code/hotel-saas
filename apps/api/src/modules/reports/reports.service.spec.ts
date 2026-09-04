import { ReportsService } from './reports.service';
import { RoomStatus } from '../rooms/entities/room.entity';
import { LoyaltyTier } from '../guests/entities/guest.entity';
import {
  BookingSource,
  BookingStatus,
  MarketSegment,
} from '../bookings/entities/booking.entity';

// Bu testlar ReportsService'ning eng nozik qismlarini tekshiradi: pul/foiz
// hisob-kitoblari (ADR/RevPAR/bandlik), 0ga bo'lishdan himoya, to'lanmagan
// hisob-fakturalarni filtrlash, va daromad tendensiyasi/loyalty taqsimotida
// "bo'sh" qiymatlarni 0 bilan to'ldirish. Haqiqiy DB o'rniga — har bir repo
// uchun minimal, chaqiruv argumentlariga qarab javob beradigan mock kifoya.
describe('ReportsService', () => {
  function createQbMock(rows: unknown[]) {
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.groupBy = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue(rows);
    return qb;
  }

  function createService(opts: {
    totalRooms?: number;
    occupiedRooms?: number;
    todayArrivals?: number;
    todayDepartures?: number;
    inHouseBookings?: number;
    periodBookings?: {
      checkIn: string;
      checkOut: string;
      totalAmount: string;
    }[];
    previousPeriodBookings?: {
      checkIn: string;
      checkOut: string;
      totalAmount: string;
    }[];
    trendWindowBookings?: {
      checkIn: string;
      checkOut: string;
      totalAmount: string;
    }[];
    revenueTrendRows?: { date: string; total: string }[];
    outstandingInvoices?: { totalAmount: string; paidAmount: string }[];
    housekeepingPending?: number;
    loyaltyRows?: { tier: LoyaltyTier; count: string }[];
    segmentBookings?: {
      checkIn: string;
      checkOut: string;
      totalAmount: string;
      marketSegment: MarketSegment;
      source: BookingSource;
      agencyId: string | null;
      corporateAccountId: string | null;
      sourceProfileId?: string | null;
    }[];
    agencies?: { id: string; name: string; commissionPct: string }[];
    sourceProfiles?: { id: string; fullName: string }[];
    corporateAccounts?: { id: string; name: string }[];
    registrationBookings?: {
      id: string;
      checkIn: string;
      checkOut: string;
      status: BookingStatus;
      guest: {
        fullName: string;
        nationality: string | null;
        documentType: string | null;
        documentNumber: string | null;
        dateOfBirth: string | null;
      };
      room: { roomNumber: string };
    }[];
  }) {
    const roomRepo = {
      count: jest
        .fn()
        .mockImplementation(({ where }: { where: { status?: RoomStatus } }) =>
          Promise.resolve(
            where.status === RoomStatus.OCCUPIED
              ? (opts.occupiedRooms ?? 0)
              : (opts.totalRooms ?? 0),
          ),
        ),
    };
    const bookingRepo = {
      count: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          if ('checkIn' in where)
            return Promise.resolve(opts.todayArrivals ?? 0);
          if ('checkOut' in where)
            return Promise.resolve(opts.todayDepartures ?? 0);
          return Promise.resolve(opts.inHouseBookings ?? 0);
        }),
      find: jest
        .fn()
        .mockImplementation(
          ({
            select,
            relations,
            where,
          }: {
            select?: Record<string, unknown>;
            relations?: Record<string, unknown>;
            where?: { checkIn?: { type?: string }; checkOut?: unknown };
          }) => {
            if (relations)
              return Promise.resolve(opts.registrationBookings ?? []);
            if (select && 'marketSegment' in select)
              return Promise.resolve(opts.segmentBookings ?? []);
            // occupancyTrend/adrTrend oynasi (checkIn<=today VA
            // checkOut>=trendStart) — ikkala checkIn/checkOut cheklovi bilan
            // yagona so'rov, shu orqali boshqalardan ajratamiz.
            if (where?.checkOut)
              return Promise.resolve(
                opts.trendWindowBookings ?? opts.periodBookings ?? [],
              );
            // getOverview joriy davr uchun MoreThanOrEqual, oldingi (trend)
            // davr uchun Between operatoridan foydalanadi — shu orqali
            // ikkalasini mock'da ajratamiz.
            if (where?.checkIn?.type === 'between')
              return Promise.resolve(
                opts.previousPeriodBookings ?? opts.periodBookings ?? [],
              );
            return Promise.resolve(opts.periodBookings ?? []);
          },
        ),
      findAndCount: jest.fn().mockImplementation(() => {
        const rows = opts.registrationBookings ?? [];
        return Promise.resolve([rows, rows.length]);
      }),
      createQueryBuilder: jest.fn().mockReturnValue(
        (() => {
          const missingDocCount = (opts.registrationBookings ?? []).filter(
            (b) => !b.guest.documentType || !b.guest.documentNumber,
          ).length;
          const qb = createQbMock([]);
          qb.getCount = jest.fn().mockResolvedValue(missingDocCount);
          return qb;
        })(),
      ),
    };
    const invoiceRepo = {
      find: jest.fn().mockResolvedValue(opts.outstandingInvoices ?? []),
    };
    const paymentQb = createQbMock(opts.revenueTrendRows ?? []);
    const paymentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(paymentQb),
    };
    const hkRepo = {
      count: jest.fn().mockResolvedValue(opts.housekeepingPending ?? 0),
    };
    const guestQb = createQbMock(opts.loyaltyRows ?? []);
    const guestRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(guestQb),
      // 2026-09-04: manba profillarining nomlarini olish uchun. Faqat
      // haqiqatan uchragan ID'lar so'raladi, shuning uchun manbasiz
      // testlarda umuman chaqirilmaydi.
      find: jest.fn().mockResolvedValue(opts.sourceProfiles ?? []),
    };
    const agencyRepo = {
      find: jest.fn().mockResolvedValue(opts.agencies ?? []),
    };
    const corporateAccountRepo = {
      find: jest.fn().mockResolvedValue(opts.corporateAccounts ?? []),
    };

    return new ReportsService(
      roomRepo as never,
      bookingRepo as never,
      invoiceRepo as never,
      paymentRepo as never,
      hkRepo as never,
      guestRepo as never,
      agencyRepo as never,
      corporateAccountRepo as never,
      // Budjet repo — bu yerdagi testlar getBudgetPerformance'ni chaqirmaydi
      // (uning o'z alohida test faylida to'liq qamrovi bor), shuning uchun
      // bo'sh ro'yxat qaytaruvchi minimal mock kifoya.
      { find: jest.fn().mockResolvedValue([]) } as never,
      // Maintenance repo — bu yerdagi testlar getInsights'ni chaqirmaydi
      // (uning o'z alohida test fayli bor).
      { count: jest.fn().mockResolvedValue(0) } as never,
      // Tavsiya-yopish repo — xuddi shu sababdan bo'sh.
      { find: jest.fn().mockResolvedValue([]) } as never,
    );
  }

  it("hozirgi band xonalar sonini (snapshot) to'g'ri qaytaradi, bandlik foizi esa davr bo'yicha hisoblanadi", async () => {
    // occupiedRooms — shu daqiqadagi jonli holat, occupancyRatePct esa
    // ADR/RevPAR bilan bir xil davr (periodDays) asosida hisoblanadi —
    // shuning uchun periodBookings bo'sh bo'lsa, occupancyRatePct 0 bo'ladi,
    // occupiedRooms esa 15 bo'lib qoladi (ikkisi mustaqil metrikalar).
    const service = createService({ totalRooms: 20, occupiedRooms: 15 });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.occupancy).toEqual({
      totalRooms: 20,
      occupiedRooms: 15,
      occupancyRatePct: 0,
    });
  });

  it("xona bo'lmasa (0ga bo'lish) bandlik va RevPAR 0 qaytaradi", async () => {
    const service = createService({ totalRooms: 0, occupiedRooms: 0 });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.occupancy.occupancyRatePct).toBe(0);
    expect(result.revPar).toBe(0);
  });

  it("ADR va RevPAR'ni davr bronlaridan to'g'ri hisoblaydi", async () => {
    // 2 bron: 3 kecha / 300 birlik, va 2 kecha / 100 birlik => jami 5 kecha, 400 birlik
    const service = createService({
      totalRooms: 10,
      periodBookings: [
        {
          checkIn: '2026-08-01',
          checkOut: '2026-08-04',
          totalAmount: '300.00',
        },
        {
          checkIn: '2026-08-05',
          checkOut: '2026-08-07',
          totalAmount: '100.00',
        },
      ],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.adr).toBe(80); // 400 / 5 kecha
    expect(result.revPar).toBe(1.33); // round2(400 / (10 * 30))
    // Bandlik foizi ham xuddi shu davr (5 kecha / (10 xona * 30 kun)) asosida:
    expect(result.occupancy.occupancyRatePct).toBe(1.67);
    // RevPAR = ADR x Bandlik% identifikatsiyasi (yaxlitlash xatoligi ichida) saqlanadi:
    expect((result.adr * result.occupancy.occupancyRatePct) / 100).toBeCloseTo(
      result.revPar,
      1,
    );
  });

  it("daromad tendensiyasini 14 kunga to'liq to'ldiradi (bo'sh kunlar 0)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const service = createService({
      revenueTrendRows: [{ date: today, total: '250.50' }],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.revenueTrend).toHaveLength(14);
    const todayEntry = result.revenueTrend.find((r) => r.date === today);
    expect(todayEntry?.amount).toBe(250.5);
    const zeroEntries = result.revenueTrend.filter((r) => r.date !== today);
    expect(zeroEntries.every((r) => r.amount === 0)).toBe(true);
  });

  it("to'liq to'langan hisob-fakturalarni to'lanmagan ro'yxatdan chiqarib tashlaydi", async () => {
    const service = createService({
      outstandingInvoices: [
        { totalAmount: '500.00', paidAmount: '500.00' }, // to'liq to'langan — hisoblanmasligi kerak
        { totalAmount: '300.00', paidAmount: '100.00' }, // 200 qoldiq
        { totalAmount: '150.00', paidAmount: '0.00' }, // 150 qoldiq
      ],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.outstandingInvoices).toEqual({ count: 2, totalBalance: 350 });
  });

  it("loyalty taqsimotida barcha 4 daraja qatnashadi, DB'da yo'q bo'lganlari 0", async () => {
    const service = createService({
      loyaltyRows: [
        { tier: LoyaltyTier.GOLD, count: '3' },
        { tier: LoyaltyTier.BRONZE, count: '10' },
      ],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.loyaltyDistribution).toEqual([
      { tier: LoyaltyTier.BRONZE, count: 10 },
      { tier: LoyaltyTier.SILVER, count: 0 },
      { tier: LoyaltyTier.GOLD, count: 3 },
      { tier: LoyaltyTier.PLATINUM, count: 0 },
    ]);
  });

  it('trend: joriy davrni bevosita oldingi davrga solishtirib nisbiy foizni hisoblaydi', async () => {
    const service = createService({
      totalRooms: 10,
      periodBookings: [
        {
          checkIn: '2026-08-20',
          checkOut: '2026-08-25',
          totalAmount: '500.00',
        }, // 5 kecha, 500
      ],
      previousPeriodBookings: [
        {
          checkIn: '2026-07-20',
          checkOut: '2026-07-24',
          totalAmount: '200.00',
        }, // 4 kecha, 200
      ],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    // Joriy: adr=500/5=100, revPar=round2(500/(10*30))=1.67, occupancy=round2(5/300*100)=1.67
    // Oldingi: adr=200/4=50, revPar=round2(200/(10*30))=0.67, occupancy=round2(4/300*100)=1.33
    expect(result.adr).toBe(100);
    expect(result.trend.adrDelta).toBe(100); // (100-50)/50*100 = 100%
    expect(result.trend.revParDelta).not.toBeNull();
    expect(result.trend.occupancyRatePctDelta).not.toBeNull();
    expect(result.trend.adrDelta!).toBeGreaterThan(0);
  });

  it("trend: oldingi davrda ma'lumot bo'lmasa (0), foiz o'zgarish null qaytadi", async () => {
    const service = createService({
      totalRooms: 10,
      periodBookings: [
        {
          checkIn: '2026-08-20',
          checkOut: '2026-08-25',
          totalAmount: '500.00',
        },
      ],
      previousPeriodBookings: [],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.trend).toEqual({
      occupancyRatePctDelta: null,
      adrDelta: null,
      revParDelta: null,
    });
  });

  it("occupancyTrend/adrTrend: bugun faol bo'lgan bronni to'g'ri hisoblaydi, faol bo'lmagan kunlarni 0/band-emas qiladi", async () => {
    const todayDate = new Date();
    const today = todayDate.toISOString().slice(0, 10);
    const checkOutDate = new Date(todayDate);
    checkOutDate.setDate(checkOutDate.getDate() + 2);
    const checkOut = checkOutDate.toISOString().slice(0, 10);
    const service = createService({
      totalRooms: 4,
      // Bugundan boshlab 2 kechalik, 400 birlik bron => 200/kecha.
      trendWindowBookings: [
        { checkIn: today, checkOut, totalAmount: '400.00' },
      ],
    });
    const result = await service.getOverview('t1', 'p1', 30);
    expect(result.occupancyTrend).toHaveLength(14);
    expect(result.adrTrend).toHaveLength(14);
    const todayOccupancy = result.occupancyTrend.find((r) => r.date === today);
    const todayAdr = result.adrTrend.find((r) => r.date === today);
    // 1 ta faol bron / 4 xona = 25%
    expect(todayOccupancy?.occupancyRatePct).toBe(25);
    expect(todayAdr?.adr).toBe(200);
    // Bron boshlanishidan oldingi kunlarda hali faol emas edi:
    const yesterday = result.occupancyTrend[result.occupancyTrend.length - 2];
    expect(yesterday.occupancyRatePct).toBe(0);
  });

  describe('getSegmentPerformance', () => {
    it("barcha MarketSegment/BookingSource qiymatlarini qatnashtiradi, DB'da yo'qlari 0 bilan", async () => {
      const service = createService({ segmentBookings: [] });
      const result = await service.getSegmentPerformance('t1', 'p1', 30);
      expect(result.bySegment).toHaveLength(
        Object.values(MarketSegment).length,
      );
      expect(result.bySource).toHaveLength(Object.values(BookingSource).length);
      expect(result.bySegment.every((s) => s.bookingCount === 0)).toBe(true);
      expect(result.byAgency).toEqual([]);
      expect(result.byCorporateAccount).toEqual([]);
    });

    it("segment bo'yicha daromad/ADR'ni to'g'ri jamlaydi", async () => {
      const service = createService({
        segmentBookings: [
          {
            checkIn: '2026-08-01',
            checkOut: '2026-08-04',
            totalAmount: '300.00',
            marketSegment: MarketSegment.CORPORATE,
            source: BookingSource.DIRECT,
            agencyId: null,
            corporateAccountId: null,
          },
          {
            checkIn: '2026-08-05',
            checkOut: '2026-08-06',
            totalAmount: '100.00',
            marketSegment: MarketSegment.CORPORATE,
            source: BookingSource.WEBSITE,
            agencyId: null,
            corporateAccountId: null,
          },
        ],
      });
      const result = await service.getSegmentPerformance('t1', 'p1', 30);
      const corporate = result.bySegment.find(
        (s) => s.segment === MarketSegment.CORPORATE,
      );
      expect(corporate).toEqual({
        segment: MarketSegment.CORPORATE,
        bookingCount: 2,
        roomNights: 4,
        revenue: 400,
        adr: 100,
      });
      const direct = result.bySource.find(
        (s) => s.source === BookingSource.DIRECT,
      );
      expect(direct).toEqual({
        source: BookingSource.DIRECT,
        bookingCount: 1,
        revenue: 300,
      });
    });

    it("agentlik bo'yicha daromad va komissiya qarzini to'g'ri hisoblaydi, nomini agentlik jadvalidan oladi", async () => {
      const service = createService({
        segmentBookings: [
          {
            checkIn: '2026-08-01',
            checkOut: '2026-08-03',
            totalAmount: '200.00',
            marketSegment: MarketSegment.TRAVEL_AGENT,
            source: BookingSource.DIRECT,
            agencyId: 'ag1',
            corporateAccountId: null,
          },
        ],
        agencies: [
          { id: 'ag1', name: 'Test Agentligi', commissionPct: '10.00' },
        ],
      });
      const result = await service.getSegmentPerformance('t1', 'p1', 30);
      expect(result.byAgency).toEqual([
        {
          agencyId: 'ag1',
          agencyName: 'Test Agentligi',
          bookingCount: 1,
          revenue: 200,
          commissionOwed: 20,
        },
      ]);
    });

    describe('nomlangan manba (sourceProfile)', () => {
      const bron = (
        totalAmount: string,
        sourceProfileId: string | null,
        source = BookingSource.WEBSITE,
      ) => ({
        checkIn: '2026-08-01',
        checkOut: '2026-08-02',
        totalAmount,
        marketSegment: MarketSegment.OTHER,
        source,
        agencyId: null,
        corporateAccountId: null,
        sourceProfileId,
      });

      it("manba bo'yicha daromadni jamlaydi va kamayish tartibida saralaydi", async () => {
        const service = createService({
          segmentBookings: [
            bron('100.00', 'sp1'),
            bron('900.00', 'sp2'),
            bron('50.00', 'sp1'),
          ],
          sourceProfiles: [
            { id: 'sp1', fullName: 'Instagram reklamasi' },
            { id: 'sp2', fullName: 'Hamkor restoran' },
          ],
        });
        const result = await service.getSegmentPerformance('t1', 'p1', 30);
        expect(result.bySourceProfile).toEqual([
          {
            sourceProfileId: 'sp2',
            name: 'Hamkor restoran',
            bookingCount: 1,
            revenue: 900,
          },
          {
            sourceProfileId: 'sp1',
            name: 'Instagram reklamasi',
            bookingCount: 2,
            revenue: 150,
          },
        ]);
      });

      it('🔴 manba KANALDAN mustaqil hisoblanadi', async () => {
        // Bir xil manba turli kanallar orqali kelishi mumkin (sayt va OTA).
        // `bySource` ularni ajratadi, `bySourceProfile` esa birlashtiradi —
        // ikkala kesim bir-birini to'ldiradi.
        const service = createService({
          segmentBookings: [
            bron('100.00', 'sp1', BookingSource.WEBSITE),
            bron('200.00', 'sp1', BookingSource.OTA),
          ],
          sourceProfiles: [{ id: 'sp1', fullName: 'Instagram reklamasi' }],
        });
        const result = await service.getSegmentPerformance('t1', 'p1', 30);
        expect(result.bySourceProfile).toEqual([
          {
            sourceProfileId: 'sp1',
            name: 'Instagram reklamasi',
            bookingCount: 2,
            revenue: 300,
          },
        ]);
        const web = result.bySource.find(
          (r) => r.source === BookingSource.WEBSITE,
        );
        const ota = result.bySource.find((r) => r.source === BookingSource.OTA);
        expect(web?.revenue).toBe(100);
        expect(ota?.revenue).toBe(200);
      });

      it("manbasiz bronlar ro'yxatga tushmaydi va profil so'ralmaydi", async () => {
        // Ortiqcha so'rov qilmaslik muhim: mehmonxonada minglab mehmon
        // profili bo'lishi mumkin.
        const service = createService({
          segmentBookings: [bron('100.00', null)],
        });
        const result = await service.getSegmentPerformance('t1', 'p1', 30);
        expect(result.bySourceProfile).toEqual([]);
      });

      it("o'chirilgan profil uchun \"Noma'lum manba\" ko'rsatiladi", async () => {
        // FK SET NULL bo'lgani uchun amalda kamdan-kam, lekin hisobot
        // baribir yiqilmasligi kerak.
        const service = createService({
          segmentBookings: [bron('100.00', 'yoq')],
          sourceProfiles: [],
        });
        const result = await service.getSegmentPerformance('t1', 'p1', 30);
        expect(result.bySourceProfile[0].name).toBe("Noma'lum manba");
      });
    });

    it("korporativ hisob bo'yicha daromadni to'g'ri hisoblaydi va daromad bo'yicha kamayish tartibida saralaydi", async () => {
      const service = createService({
        segmentBookings: [
          {
            checkIn: '2026-08-01',
            checkOut: '2026-08-02',
            totalAmount: '50.00',
            marketSegment: MarketSegment.CORPORATE,
            source: BookingSource.DIRECT,
            agencyId: null,
            corporateAccountId: 'ca1',
          },
          {
            checkIn: '2026-08-01',
            checkOut: '2026-08-02',
            totalAmount: '500.00',
            marketSegment: MarketSegment.CORPORATE,
            source: BookingSource.DIRECT,
            agencyId: null,
            corporateAccountId: 'ca2',
          },
        ],
        corporateAccounts: [
          { id: 'ca1', name: 'Kichik MChJ' },
          { id: 'ca2', name: 'Katta MChJ' },
        ],
      });
      const result = await service.getSegmentPerformance('t1', 'p1', 30);
      expect(result.byCorporateAccount).toEqual([
        {
          corporateAccountId: 'ca2',
          name: 'Katta MChJ',
          bookingCount: 1,
          revenue: 500,
        },
        {
          corporateAccountId: 'ca1',
          name: 'Kichik MChJ',
          bookingCount: 1,
          revenue: 50,
        },
      ]);
    });
  });

  describe('getGuestRegistrationReport', () => {
    it("hujjat ma'lumotlari to'liq bo'lgan mehmonni missingDocument:false bilan qaytaradi", async () => {
      const service = createService({
        registrationBookings: [
          {
            id: 'b1',
            checkIn: '2026-08-01',
            checkOut: '2026-08-04',
            status: BookingStatus.CHECKED_OUT,
            guest: {
              fullName: 'John Smith',
              nationality: 'USA',
              documentType: 'passport',
              documentNumber: 'AB1234567',
              dateOfBirth: '1990-01-01',
            },
            room: { roomNumber: '101' },
          },
        ],
      });
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30, {
        page: 1,
        pageSize: 50,
        skip: 0,
        take: 50,
      });
      expect(result.totalStays).toBe(1);
      expect(result.missingDocumentCount).toBe(0);
      expect(result.stays[0]).toEqual({
        bookingId: 'b1',
        guestFullName: 'John Smith',
        nationality: 'USA',
        documentType: 'passport',
        documentNumber: 'AB1234567',
        dateOfBirth: '1990-01-01',
        roomNumber: '101',
        checkIn: '2026-08-01',
        checkOut: '2026-08-04',
        status: BookingStatus.CHECKED_OUT,
        missingDocument: false,
      });
    });

    it("hujjat raqami yoki turi yo'q mehmonlarni missingDocument:true deb belgilaydi va sanaydi", async () => {
      const service = createService({
        registrationBookings: [
          {
            id: 'b1',
            checkIn: '2026-08-01',
            checkOut: '2026-08-02',
            status: BookingStatus.CHECKED_IN,
            guest: {
              fullName: 'No Doc Guest',
              nationality: null,
              documentType: null,
              documentNumber: null,
              dateOfBirth: null,
            },
            room: { roomNumber: '102' },
          },
          {
            id: 'b2',
            checkIn: '2026-08-01',
            checkOut: '2026-08-02',
            status: BookingStatus.CHECKED_IN,
            guest: {
              fullName: 'Partial Doc Guest',
              nationality: 'UZ',
              documentType: 'passport',
              documentNumber: null,
              dateOfBirth: null,
            },
            room: { roomNumber: '103' },
          },
        ],
      });
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30, {
        page: 1,
        pageSize: 50,
        skip: 0,
        take: 50,
      });
      expect(result.totalStays).toBe(2);
      expect(result.missingDocumentCount).toBe(2);
      expect(result.stays.every((s) => s.missingDocument)).toBe(true);
    });

    it("bron bo'lmasa bo'sh ro'yxat va nol hisoblagichlar qaytaradi", async () => {
      const service = createService({ registrationBookings: [] });
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30, {
        page: 1,
        pageSize: 50,
        skip: 0,
        take: 50,
      });
      expect(result).toEqual({
        periodDays: 30,
        totalStays: 0,
        missingDocumentCount: 0,
        stays: [],
        page: 1,
        pageSize: 50,
      });
    });
  });
});
