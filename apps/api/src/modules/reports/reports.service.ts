import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Invoice, InvoiceStatus } from '../invoicing/entities/invoice.entity';
import { InvoicePayment } from '../invoicing/entities/invoice-payment.entity';
import {
  HousekeepingTask,
  HousekeepingTaskStatus,
} from '../housekeeping/entities/housekeeping-task.entity';
import { Guest, LoyaltyTier } from '../guests/entities/guest.entity';

export interface ReportsOverviewDto {
  asOfDate: string;
  periodDays: number;
  occupancy: {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRatePct: number;
  };
  todayArrivals: number;
  todayDepartures: number;
  inHouseBookings: number;
  adr: number; // Average Daily Rate — tanlangan davr uchun
  revPar: number; // Revenue Per Available Room — tanlangan davr uchun
  revenueTrend: { date: string; amount: number }[]; // oxirgi 14 kun, kunlik qabul qilingan to'lovlar
  outstandingInvoices: { count: number; totalBalance: number };
  housekeepingPending: number;
  loyaltyDistribution: { tier: string; count: number }[];
}

const TREND_DAYS = 14;
const ALL_LOYALTY_TIERS = [
  LoyaltyTier.BRONZE,
  LoyaltyTier.SILVER,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];

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

    const [
      totalRooms,
      occupiedRooms,
      todayArrivals,
      todayDepartures,
      inHouseBookings,
      periodBookings,
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
      this.paymentRepo
        .createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select("to_char(payment.createdAt, 'YYYY-MM-DD')", 'date')
        .addSelect('SUM(payment.amount)', 'total')
        .where('invoice.tenantId = :tenantId', { tenantId })
        .andWhere('invoice.propertyId = :propertyId', { propertyId })
        .andWhere('payment.createdAt >= :trendStart', {
          trendStart: `${isoDate(new Date(Date.now() - (TREND_DAYS - 1) * 86_400_000))} 00:00:00`,
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

    return {
      asOfDate: today,
      periodDays,
      occupancy: {
        totalRooms,
        occupiedRooms,
        occupancyRatePct:
          totalRooms > 0 ? round2((occupiedRooms / totalRooms) * 100) : 0,
      },
      todayArrivals,
      todayDepartures,
      inHouseBookings,
      adr,
      revPar,
      revenueTrend,
      outstandingInvoices: {
        count: outstandingCount,
        totalBalance: round2(outstandingTotal),
      },
      housekeepingPending,
      loyaltyDistribution,
    };
  }
}
