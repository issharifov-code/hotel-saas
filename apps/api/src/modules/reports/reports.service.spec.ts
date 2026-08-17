import { ReportsService } from './reports.service';
import { RoomStatus } from '../rooms/entities/room.entity';
import { LoyaltyTier } from '../guests/entities/guest.entity';

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
      find: jest.fn().mockResolvedValue(opts.periodBookings ?? []),
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

    return new ReportsService(
      roomRepo as never,
      bookingRepo as never,
      invoiceRepo as never,
      paymentRepo as never,
      hkRepo as never,
      guestRepo as never,
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
    expect(
      (result.adr * result.occupancy.occupancyRatePct) / 100,
    ).toBeCloseTo(result.revPar, 1);
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
});
