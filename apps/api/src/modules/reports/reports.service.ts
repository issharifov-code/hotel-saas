import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import {
  Booking,
  BookingSource,
  BookingStatus,
  MarketSegment,
} from '../bookings/entities/booking.entity';
import { Invoice, InvoiceStatus } from '../invoicing/entities/invoice.entity';
import { InvoicePayment } from '../invoicing/entities/invoice-payment.entity';
import {
  HousekeepingTask,
  HousekeepingTaskStatus,
} from '../housekeeping/entities/housekeeping-task.entity';
import { Guest, LoyaltyTier } from '../guests/entities/guest.entity';
import { Agency } from '../agencies/entities/agency.entity';
import { CorporateAccount } from '../city-ledger/entities/corporate-account.entity';
import { PaginationParams } from '../../common/utils/pagination.util';

export interface ReportsOverviewDto {
  asOfDate: string;
  periodDays: number;
  occupancy: {
    totalRooms: number;
    occupiedRooms: number; // hozirgi (shu daqiqadagi) band xonalar soni — jonli holat
    occupancyRatePct: number; // davr bo'yicha o'rtacha bandlik — ADR/RevPAR bilan bir xil davrga tayanadi
  };
  todayArrivals: number;
  todayDepartures: number;
  inHouseBookings: number;
  adr: number; // Average Daily Rate — tanlangan davr uchun
  revPar: number; // Revenue Per Available Room — tanlangan davr uchun
  revenueTrend: { date: string; amount: number }[]; // oxirgi 14 kun, kunlik qabul qilingan to'lovlar
  // Dashboard grafigidagi Revenue/ADR/Occupancy almashtirgichi uchun (2026-09) —
  // revenueTrend'dan farqli (qabul qilingan to'lov sanasi), bular kunning
  // o'zida FAOL bo'lgan (checkIn <= kun < checkOut) bronlar asosida: har bir
  // kun uchun band xona-tunlar %'i va faol bronlar bo'yicha o'rtacha kechalik
  // narx (nightlyRate = totalAmount/nights, shu kunlarda faol bo'lganlar
  // bo'yicha o'rtacha).
  occupancyTrend: { date: string; occupancyRatePct: number }[];
  adrTrend: { date: string; adr: number }[];
  outstandingInvoices: { count: number; totalBalance: number };
  housekeepingPending: number;
  loyaltyDistribution: { tier: string; count: number }[];
  // Dashboard'dagi trend strelkalari uchun (2026-09) — joriy davr shu uzunlikdagi
  // BEVOSITA OLDINGI davrga solishtirilgan nisbiy foiz o'zgarishi (masalan
  // periodDays=30 bo'lsa, oxirgi 30 kun undan oldingi 30 kun bilan
  // solishtiriladi). Oldingi davrda tegishli qiymat 0 bo'lsa (masalan yangi
  // mehmonxona, hali bron bo'lmagan), foiz o'zgarish ma'nosiz bo'lgani uchun
  // `null` qaytariladi — frontend bunday holatda strelkani ko'rsatmaydi.
  trend: {
    occupancyRatePctDelta: number | null;
    adrDelta: number | null;
    revParDelta: number | null;
  };
}

// Segment/kanal/agentlik/korporativ hisob bo'yicha daromad taqsimoti —
// mavjud Booking.marketSegment/source/agencyId/corporateAccountId ustunlarini
// (yozish yo'li allaqachon bor, lekin hech qanday hisobot ularni o'qimasdi)
// birinchi marta haqiqiy tahlilga bog'laydi.
export interface SegmentPerformanceDto {
  periodDays: number;
  bySegment: {
    segment: MarketSegment;
    bookingCount: number;
    roomNights: number;
    revenue: number;
    adr: number;
  }[];
  bySource: { source: BookingSource; bookingCount: number; revenue: number }[];
  byAgency: {
    agencyId: string;
    agencyName: string;
    bookingCount: number;
    revenue: number;
    commissionOwed: number;
  }[];
  byCorporateAccount: {
    corporateAccountId: string;
    name: string;
    bookingCount: number;
    revenue: number;
  }[];
}

// Mehmonlarni ro'yxatga olish (statutory guest registration) hisoboti —
// Guest.documentType/documentNumber/nationality/dateOfBirth ustunlarini
// (Guest entity izohida "front_desk moduli keyinchalik davlat tizimiga
// hisobot berishda shundan foydalanadi" deb qoldirilgan, lekin hech qanday
// hisobot ularni birgalikda o'qimasdi) birinchi marta haqiqiy hisobotga
// bog'laydi. O'zbekistonda mehmonxonalar, ayniqsa xorijiy fuqarolarni,
// migratsiya/politsiya organlariga ro'yxatga olib borishi talab qilinadi.
export interface GuestRegistrationStayDto {
  bookingId: string;
  guestFullName: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  missingDocument: boolean;
}

export interface GuestRegistrationReportDto {
  periodDays: number;
  totalStays: number;
  missingDocumentCount: number;
  stays: GuestRegistrationStayDto[];
  page: number;
  pageSize: number;
}

const TREND_DAYS = 14;
const ALL_LOYALTY_TIERS = [
  LoyaltyTier.BRONZE,
  LoyaltyTier.SILVER,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];
const ALL_MARKET_SEGMENTS = Object.values(MarketSegment);
const ALL_BOOKING_SOURCES = Object.values(BookingSource);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(startIso: string, endIso: string): number {
  const ms = Date.parse(endIso) - Date.parse(startIso);
  return Math.max(1, Math.round(ms / 86_400_000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Mehmonxona uchun asosiy KPI'larni (bandlik, ADR, RevPAR, daromad tendensiyasi,
// to'lanmagan hisob-fakturalar, loyalty taqsimoti va h.k.) yig'ib beradigan
// faqat-o'qish (read-only) hisobot servisi. Hech qanday yozish operatsiyasi yo'q —
// mavjud Booking/Invoice/Room/HousekeepingTask/Guest ma'lumotlarini agregatlaydi.
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoicePayment)
    private readonly paymentRepo: Repository<InvoicePayment>,
    @InjectRepository(HousekeepingTask)
    private readonly hkRepo: Repository<HousekeepingTask>,
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(Agency) private readonly agencyRepo: Repository<Agency>,
    @InjectRepository(CorporateAccount)
    private readonly corporateAccountRepo: Repository<CorporateAccount>,
  ) {}

  async getOverview(
    tenantId: string,
    propertyId: string,
    periodDays: number,
  ): Promise<ReportsOverviewDto> {
    const today = isoDate(new Date());
    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - periodDays);
    const periodStart = isoDate(periodStartDate);

    // Trend strelkalari uchun — joriy davrdan bevosita oldingi, xuddi shunday
    // uzunlikdagi (periodDays) davr, ustma-ust tushmasligi uchun bir kunlik
    // bo'shliq bilan (previousPeriodEnd = periodStart - 1 kun).
    const previousPeriodEndDate = new Date(periodStartDate);
    previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1);
    const previousPeriodStartDate = new Date(previousPeriodEndDate);
    previousPeriodStartDate.setDate(
      previousPeriodStartDate.getDate() - (periodDays - 1),
    );
    const previousPeriodStart = isoDate(previousPeriodStartDate);
    const previousPeriodEnd = isoDate(previousPeriodEndDate);

    // revenueTrend, occupancyTrend va adrTrend uchun umumiy oyna boshlanishi.
    const trendStartIso = isoDate(
      new Date(Date.now() - (TREND_DAYS - 1) * 86_400_000),
    );

    const [
      totalRooms,
      occupiedRooms,
      todayArrivals,
      todayDepartures,
      inHouseBookings,
      periodBookings,
      previousPeriodBookings,
      trendWindowBookings,
      revenueTrendRows,
      outstandingInvoices,
      housekeepingPending,
      loyaltyRows,
    ] = await Promise.all([
      this.roomRepo.count({ where: { tenantId, propertyId } }),
      this.roomRepo.count({
        where: { tenantId, propertyId, status: RoomStatus.OCCUPIED },
      }),
      this.bookingRepo.count({
        where: {
          tenantId,
          propertyId,
          checkIn: today,
          status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        },
      }),
      this.bookingRepo.count({
        where: {
          tenantId,
          propertyId,
          checkOut: today,
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
      }),
      this.bookingRepo.count({
        where: { tenantId, propertyId, status: BookingStatus.CHECKED_IN },
      }),
      this.bookingRepo.find({
        where: {
          tenantId,
          propertyId,
          checkIn: MoreThanOrEqual(periodStart),
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
        select: { checkIn: true, checkOut: true, totalAmount: true },
      }),
      this.bookingRepo.find({
        where: {
          tenantId,
          propertyId,
          checkIn: Between(previousPeriodStart, previousPeriodEnd),
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
        select: { checkIn: true, checkOut: true, totalAmount: true },
      }),
      this.bookingRepo.find({
        where: {
          tenantId,
          propertyId,
          checkIn: LessThanOrEqual(today),
          checkOut: MoreThanOrEqual(trendStartIso),
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
        select: { checkIn: true, checkOut: true, totalAmount: true },
      }),
      this.paymentRepo
        .createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select("to_char(payment.createdAt, 'YYYY-MM-DD')", 'date')
        .addSelect('SUM(payment.amount)', 'total')
        .where('invoice.tenantId = :tenantId', { tenantId })
        .andWhere('invoice.propertyId = :propertyId', { propertyId })
        .andWhere('payment.createdAt >= :trendStart', {
          trendStart: `${trendStartIso} 00:00:00`,
        })
        .groupBy("to_char(payment.createdAt, 'YYYY-MM-DD')")
        .getRawMany<{ date: string; total: string }>(),
      this.invoiceRepo.find({
        where: {
          tenantId,
          propertyId,
          status: In([InvoiceStatus.OPEN, InvoiceStatus.ISSUED]),
        },
        select: { totalAmount: true, paidAmount: true },
      }),
      this.hkRepo.count({
        where: {
          tenantId,
          propertyId,
          status: In([
            HousekeepingTaskStatus.PENDING,
            HousekeepingTaskStatus.IN_PROGRESS,
          ]),
        },
      }),
      this.guestRepo
        .createQueryBuilder('guest')
        .select('guest.loyaltyTier', 'tier')
        .addSelect('COUNT(*)', 'count')
        .where('guest.tenantId = :tenantId', { tenantId })
        .groupBy('guest.loyaltyTier')
        .getRawMany<{ tier: LoyaltyTier; count: string }>(),
    ]);

    // ADR/RevPAR: davr ichida kelib tushgan (check-in qilingan) bronlar bo'yicha.
    let roomRevenue = 0;
    let roomNights = 0;
    for (const b of periodBookings) {
      const nights = daysBetween(b.checkIn, b.checkOut);
      roomRevenue += Number(b.totalAmount);
      roomNights += nights;
    }
    const adr = roomNights > 0 ? round2(roomRevenue / roomNights) : 0;
    const revPar =
      totalRooms > 0 ? round2(roomRevenue / (totalRooms * periodDays)) : 0;
    // Bandlik foizi ham xuddi ADR/RevPAR kabi shu davr (periodDays) bo'yicha
    // o'rtacha qiymat sifatida hisoblanadi (band kecha-xonalar / mavjud
    // kecha-xonalar), "hozirgi holat" snapshot emas — shunday qilib
    // RevPAR = ADR x Bandlik% identifikatsiyasi doim to'g'ri chiqadi
    // (avval occupancyRatePct "hozir"gi holatdan, adr/revPar esa davr
    // o'rtachasidan hisoblanardi, bu ikkisi mos kelmasdi).
    const occupancyRatePct =
      totalRooms > 0
        ? round2((roomNights / (totalRooms * periodDays)) * 100)
        : 0;

    // Oxirgi TREND_DAYS kun uchun to'liq sana ketma-ketligini quramiz (bo'sh
    // kunlar 0 bilan to'ldiriladi) — frontend'da uzluksiz grafik chizish uchun.
    const trendByDate = new Map(
      revenueTrendRows.map((r) => [r.date, Number(r.total)]),
    );
    const revenueTrend: { date: string; amount: number }[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = isoDate(new Date(Date.now() - i * 86_400_000));
      revenueTrend.push({ date: d, amount: round2(trendByDate.get(d) ?? 0) });
    }

    // occupancyTrend/adrTrend: har bir kun uchun o'sha kuni FAOL (checkIn <=
    // kun < checkOut) bronlarni sanaymiz. Bandlik — band xonalar / jami
    // xonalar; ADR — faol bronlar bo'yicha o'rtacha kechalik narx
    // (har bir bron uchun totalAmount/nights, keyin barcha faol bronlar
    // bo'yicha o'rtacha).
    const occupancyTrend: { date: string; occupancyRatePct: number }[] = [];
    const adrTrend: { date: string; adr: number }[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = isoDate(new Date(Date.now() - i * 86_400_000));
      let occupiedCount = 0;
      let rateSum = 0;
      let rateCount = 0;
      for (const b of trendWindowBookings) {
        if (b.checkIn <= d && d < b.checkOut) {
          occupiedCount += 1;
          const nights = daysBetween(b.checkIn, b.checkOut);
          rateSum += Number(b.totalAmount) / nights;
          rateCount += 1;
        }
      }
      occupancyTrend.push({
        date: d,
        occupancyRatePct:
          totalRooms > 0 ? round2((occupiedCount / totalRooms) * 100) : 0,
      });
      adrTrend.push({
        date: d,
        adr: rateCount > 0 ? round2(rateSum / rateCount) : 0,
      });
    }

    let outstandingCount = 0;
    let outstandingTotal = 0;
    for (const inv of outstandingInvoices) {
      const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (balance > 0.005) {
        outstandingCount += 1;
        outstandingTotal += balance;
      }
    }

    const loyaltyCounts = new Map(
      loyaltyRows.map((r) => [r.tier, Number(r.count)]),
    );
    const loyaltyDistribution = ALL_LOYALTY_TIERS.map((tier) => ({
      tier,
      count: loyaltyCounts.get(tier) ?? 0,
    }));

    // Oldingi davr uchun xuddi shu ADR/RevPAR/bandlik hisob-kitobi (yuqoridagi
    // bilan bir xil mantiq) — faqat trend strelkalari uchun, natija DTO'ning
    // asosiy maydonlariga ta'sir qilmaydi.
    let prevRoomRevenue = 0;
    let prevRoomNights = 0;
    for (const b of previousPeriodBookings) {
      const nights = daysBetween(b.checkIn, b.checkOut);
      prevRoomRevenue += Number(b.totalAmount);
      prevRoomNights += nights;
    }
    const prevAdr =
      prevRoomNights > 0 ? round2(prevRoomRevenue / prevRoomNights) : 0;
    const prevRevPar =
      totalRooms > 0 ? round2(prevRoomRevenue / (totalRooms * periodDays)) : 0;
    const prevOccupancyRatePct =
      totalRooms > 0
        ? round2((prevRoomNights / (totalRooms * periodDays)) * 100)
        : 0;

    // Oldingi davr qiymati 0 bo'lsa (masalan hali bron bo'lmagan yangi
    // mehmonxona), nisbiy foiz o'zgarish ma'nosiz bo'lgani uchun `null`.
    const pctDelta = (current: number, previous: number): number | null =>
      previous > 0 ? round2(((current - previous) / previous) * 100) : null;

    const trend = {
      occupancyRatePctDelta: pctDelta(occupancyRatePct, prevOccupancyRatePct),
      adrDelta: pctDelta(adr, prevAdr),
      revParDelta: pctDelta(revPar, prevRevPar),
    };

    return {
      asOfDate: today,
      periodDays,
      occupancy: {
        totalRooms,
        occupiedRooms,
        occupancyRatePct,
      },
      todayArrivals,
      todayDepartures,
      inHouseBookings,
      adr,
      revPar,
      revenueTrend,
      occupancyTrend,
      adrTrend,
      outstandingInvoices: {
        count: outstandingCount,
        totalBalance: round2(outstandingTotal),
      },
      housekeepingPending,
      loyaltyDistribution,
      trend,
    };
  }

  // Bozor segmenti (MarketSegment) va kanal (BookingSource) bo'yicha daromad
  // taqsimoti, hamda agentlik/korporativ hisob bo'yicha "kim qancha daromad
  // keltirmoqda" reytingi. getOverview'dagi bilan bir xil davr/ADR hisoblash
  // mantig'i (davr boshlanishi, faqat CHECKED_IN/CHECKED_OUT bronlar) qayta
  // ishlatiladi — faqat-o'qish, hech qanday yozish yo'q.
  async getSegmentPerformance(
    tenantId: string,
    propertyId: string,
    periodDays: number,
  ): Promise<SegmentPerformanceDto> {
    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - periodDays);
    const periodStart = isoDate(periodStartDate);

    const [bookings, agencies, corporateAccounts] = await Promise.all([
      this.bookingRepo.find({
        where: {
          tenantId,
          propertyId,
          checkIn: MoreThanOrEqual(periodStart),
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
        select: {
          checkIn: true,
          checkOut: true,
          totalAmount: true,
          marketSegment: true,
          source: true,
          agencyId: true,
          corporateAccountId: true,
        },
      }),
      this.agencyRepo.find({ where: { tenantId, propertyId } }),
      this.corporateAccountRepo.find({ where: { tenantId, propertyId } }),
    ]);

    const agencyById = new Map(agencies.map((a) => [a.id, a]));
    const corporateAccountById = new Map(
      corporateAccounts.map((c) => [c.id, c]),
    );

    const segmentAgg = new Map<
      MarketSegment,
      { count: number; nights: number; revenue: number }
    >();
    const sourceAgg = new Map<
      BookingSource,
      { count: number; revenue: number }
    >();
    const agencyAgg = new Map<string, { count: number; revenue: number }>();
    const corpAgg = new Map<string, { count: number; revenue: number }>();

    for (const b of bookings) {
      const nights = daysBetween(b.checkIn, b.checkOut);
      const amount = Number(b.totalAmount);

      const seg = segmentAgg.get(b.marketSegment) ?? {
        count: 0,
        nights: 0,
        revenue: 0,
      };
      seg.count += 1;
      seg.nights += nights;
      seg.revenue += amount;
      segmentAgg.set(b.marketSegment, seg);

      const src = sourceAgg.get(b.source) ?? { count: 0, revenue: 0 };
      src.count += 1;
      src.revenue += amount;
      sourceAgg.set(b.source, src);

      if (b.agencyId) {
        const a = agencyAgg.get(b.agencyId) ?? { count: 0, revenue: 0 };
        a.count += 1;
        a.revenue += amount;
        agencyAgg.set(b.agencyId, a);
      }

      if (b.corporateAccountId) {
        const c = corpAgg.get(b.corporateAccountId) ?? {
          count: 0,
          revenue: 0,
        };
        c.count += 1;
        c.revenue += amount;
        corpAgg.set(b.corporateAccountId, c);
      }
    }

    const bySegment = ALL_MARKET_SEGMENTS.map((segment) => {
      const agg = segmentAgg.get(segment) ?? {
        count: 0,
        nights: 0,
        revenue: 0,
      };
      return {
        segment,
        bookingCount: agg.count,
        roomNights: agg.nights,
        revenue: round2(agg.revenue),
        adr: agg.nights > 0 ? round2(agg.revenue / agg.nights) : 0,
      };
    });

    const bySource = ALL_BOOKING_SOURCES.map((source) => {
      const agg = sourceAgg.get(source) ?? { count: 0, revenue: 0 };
      return {
        source,
        bookingCount: agg.count,
        revenue: round2(agg.revenue),
      };
    });

    const byAgency = [...agencyAgg.entries()]
      .map(([agencyId, agg]) => {
        const agency = agencyById.get(agencyId);
        const commissionPct = agency ? Number(agency.commissionPct) : 0;
        return {
          agencyId,
          agencyName: agency?.name ?? "Noma'lum agentlik",
          bookingCount: agg.count,
          revenue: round2(agg.revenue),
          commissionOwed: round2((agg.revenue * commissionPct) / 100),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const byCorporateAccount = [...corpAgg.entries()]
      .map(([corporateAccountId, agg]) => {
        const account = corporateAccountById.get(corporateAccountId);
        return {
          corporateAccountId,
          name: account?.name ?? "Noma'lum hisob",
          bookingCount: agg.count,
          revenue: round2(agg.revenue),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return { periodDays, bySegment, bySource, byAgency, byCorporateAccount };
  }

  async getGuestRegistrationReport(
    tenantId: string,
    propertyId: string,
    periodDays: number,
    pagination: PaginationParams,
  ): Promise<GuestRegistrationReportDto> {
    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - periodDays);
    const periodStart = isoDate(periodStartDate);

    const baseWhere = {
      tenantId,
      propertyId,
      checkIn: MoreThanOrEqual(periodStart),
      status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
    };

    // `totalStays` va `missingDocumentCount` — davr bo'yicha TO'LIQ (sahifalashdan
    // mustaqil) agregatlar, shuning uchun `stays`ni sahifalab olishdan oldin
    // alohida (yengil, faqat COUNT) so'rovlar bilan hisoblanadi. Agar buni
    // faqat joriy sahifadagi qatorlardan hisoblasak, hisobot kartalari
    // (masalan "hujjati yo'q mehmonlar soni") noto'g'ri, sahifaga bog'liq
    // qiymat ko'rsatgan bo'lardi.
    const missingDocumentCount = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.guest', 'guest')
      .where('booking.tenantId = :tenantId', { tenantId })
      .andWhere('booking.propertyId = :propertyId', { propertyId })
      .andWhere('booking.checkIn >= :periodStart', { periodStart })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT],
      })
      .andWhere('(guest.documentType IS NULL OR guest.documentNumber IS NULL)')
      .getCount();

    const [bookings, totalStays] = await this.bookingRepo.findAndCount({
      where: baseWhere,
      relations: { room: true, guest: true },
      order: { checkIn: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    const stays: GuestRegistrationStayDto[] = bookings.map((b) => {
      const missingDocument = !b.guest.documentType || !b.guest.documentNumber;
      return {
        bookingId: b.id,
        guestFullName: b.guest.fullName,
        nationality: b.guest.nationality,
        documentType: b.guest.documentType,
        documentNumber: b.guest.documentNumber,
        dateOfBirth: b.guest.dateOfBirth,
        roomNumber: b.room.roomNumber,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
        missingDocument,
      };
    });

    return {
      periodDays,
      totalStays,
      missingDocumentCount,
      stays,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }
}
