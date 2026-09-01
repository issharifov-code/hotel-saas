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
    }[];
    agencies?: { id: string; name: string; commissionPct: string }[];
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
          }: {
            select?: Record<string, unknown>;
            relations?: Record<string, unknown>;
          }) => {
            if (relations)
              return Promise.resolve(opts.registrationBookings ?? []);
            return Promise.resolve(
              select && 'marketSegment' in select
                ? (opts.segmentBookings ?? [])
                : (opts.periodBookings ?? []),
            );
          },
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
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30);
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
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30);
      expect(result.totalStays).toBe(2);
      expect(result.missingDocumentCount).toBe(2);
      expect(result.stays.every((s) => s.missingDocument)).toBe(true);
    });

    it("bron bo'lmasa bo'sh ro'yxat va nol hisoblagichlar qaytaradi", async () => {
      const service = createService({ registrationBookings: [] });
      const result = await service.getGuestRegistrationReport('t1', 'p1', 30);
      expect(result).toEqual({
        periodDays: 30,
        totalStays: 0,
        missingDocumentCount: 0,
        stays: [],
      });
    });
  });
});
