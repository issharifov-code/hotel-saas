import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  MoreThan,
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
import { Budget } from '../budgets/entities/budget.entity';
import {
  MaintenanceTicket,
  MaintenanceTicketStatus,
} from '../maintenance/entities/maintenance-ticket.entity';
import { InsightDismissal } from './entities/insight-dismissal.entity';
import { PaginationParams } from '../../common/utils/pagination.util';

// "FolioOne Intelligence" — qoidaga asoslangan tavsiyalar paneli.
//
// NIMA UCHUN LLM EMAS (2026-09-04, foydalanuvchi qarori): bu yerdagi
// xulosalar moliyaviy qarorlarga ta'sir qiladi, shuning uchun ular
// (1) DETERMINISTIK — bir xil ma'lumotda doim bir xil natija,
// (2) TUSHUNTIRILADIGAN — har bir tavsiya `detail`da nega chiqqanini aniq
// raqam bilan aytadi, ya'ni menejer uni tekshira oladi.
// Tashqi LLM xizmati na kalit, na oylik to'lov talab qilmaydi — kelajakda
// qo'shilsa, shu tuzilmaning ustiga qo'shiladi.
export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface InsightDto {
  // Barqaror kalit — React `key` uchun va "e'tiborga olindi" belgisini
  // saqlash uchun (`insight_dismissals.insight_id`).
  id: string;
  severity: InsightSeverity;
  title: string;
  // Nega shu tavsiya chiqdi — aniq raqamlar bilan.
  detail: string;
  actionLabel?: string;
  actionTo?: string;
  // Foydalanuvchi buni "e'tiborga oldim" deb yopganmi.
  //
  // NIMA UCHUN JAVOBDAN OLIB TASHLANMAYDI, balki belgilanadi: (1) frontend
  // "N ta yopilgan — ko'rsatish" havolasini chizishi uchun ro'yxatni bilishi
  // kerak; (2) maydon ixtiyoriy bo'lgani uchun eski frontend yangi API bilan
  // ham buzilmaydi (deploy oynasida ikki servis bir-biriga mos kelmay
  // turadi) — u shunchaki hammasini ko'rsatadi.
  dismissed?: boolean;
}

// Yopilgan tavsiya shu muddatdan keyin QAYTADAN chiqadi.
//
// "Abadiy yopish" ataylab qilinmadi: bir marta yopilgan haqiqiy muammo
// (masalan to'lanmagan hisob-fakturalar) ko'zdan butunlay yo'qolardi.
// Bir hafta — bir marta e'tibor berib, keyin unutib yuborish uchun yetarli
// uzoq, lekin muammoni yashirib qo'yish uchun juda qisqa.
const INSIGHT_DISMISSAL_DAYS = 7;

// Jiddiylik tartibi — ham saralash, ham "holat yomonlashdimi" tekshiruvi
// uchun. Kichik raqam = jiddiyroq.
const INSIGHT_SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

// Chegaralar. Ataylab "shovqin" darajasidan yuqori: kichik tebranish har kuni
// ogohlantirish chiqarsa, panel tez orada e'tibordan qoladi.
const INSIGHT_THRESHOLDS = {
  // Davrlararo o'zgarish shu foizdan oshsa — e'tiborga loyiq.
  metricDeltaPct: 10,
  // Budjetdan chetlanish shu foizdan oshsa.
  budgetVariancePct: 10,
  // Kutilayotgan tozalash: jami xonaning shu ulushidan oshsa.
  housekeepingBacklogRatio: 0.3,
};

// "Reja vs haqiqat" — bir yilning har oyi uchun budjet va haqiqiy ko'rsatkich.
//
// MUHIM: haqiqiy qiymatlar `getOverview` bilan AYNAN BIR XIL ta'rifda
// hisoblanadi (davr ichida check-in qilgan CHECKED_IN/CHECKED_OUT bronlar
// bo'yicha: daromad = totalAmount yig'indisi, ADR = daromad/kecha-xonalar,
// bandlik = kecha-xonalar / (jami xona × kunlar)). Aks holda Dashboard'ning
// ikki joyida bir xil oy uchun turli raqamlar chiqib, foydalanuvchini
// chalg'itardi.
export interface BudgetPerformanceMonthDto {
  month: number;
  // Reja — kiritilmagan ko'rsatkich `null` (Budjet sahifasida bo'sh qoldirilgan).
  budget: {
    roomsRevenue: number | null;
    occupancyRatePct: number | null;
    adr: number | null;
  };
  actual: {
    roomsRevenue: number;
    occupancyRatePct: number;
    adr: number;
  };
  // Joriy oy hali tugamagan — daromad (yig'indi ko'rsatkich) tabiiy ravishda
  // rejadan past chiqadi, shuning uchun frontend buni alohida belgilaydi.
  // Bandlik/ADR (nisbiy ko'rsatkichlar) uchun maxraj o'tgan kunlar bo'yicha
  // olinadi, ya'ni ular partial oyda ham adolatli taqqoslanadi.
  isPartial: boolean;
  // Kelajakdagi oy — haqiqiy ma'lumot bo'lishi mumkin emas (faqat reja).
  isFuture: boolean;
}

export interface BudgetPerformanceDto {
  year: number;
  months: BudgetPerformanceMonthDto[];
}

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
  // Nomlangan MANBA bo'yicha (2026-09-04) — `Booking.sourceProfileId`.
  // Yuqoridagi `bySource` bilan aralashtirmaslik kerak: u KANAL
  // (sayt/OTA/to'g'ridan-to'g'ri), bu esa aniq manba ("Instagram
  // reklamasi"). Bron sayt orqali tushib, manbasi reklama bo'lishi mumkin —
  // ya'ni ikkala kesim bir-birini to'ldiradi, almashtirmaydi.
  bySourceProfile: {
    sourceProfileId: string;
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

// Budjet ustunlari `numeric` — TypeORM ularni matn sifatida qaytaradi, va
// kiritilmagan bo'lsa `null`. Frontend'ga raqam (yoki null) borishi kerak.
function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(MaintenanceTicket)
    private readonly maintenanceRepo: Repository<MaintenanceTicket>,
    @InjectRepository(InsightDismissal)
    private readonly dismissalRepo: Repository<InsightDismissal>,
  ) {}

  // Tavsiyalar paneli. `getOverview`ni ICHKI CHAQIRADI — shunda paneldagi
  // raqamlar Dashboard'ning qolgan qismidagi bilan kafolatli mos tushadi
  // (qayta hisoblansa, ikkalasi vaqt o'tib bir-biridan uzoqlashishi mumkin edi).
  //
  // `includeBudget` — chaqiruvchi (kontroller) foydalanuvchida accounting
  // ruxsati borligini tekshirib beradi. Budjet nozik ma'lumot, shuning uchun
  // uni faqat shu ruxsat bilan qo'shamiz.
  async getInsights(
    tenantId: string,
    propertyId: string,
    userId: string,
    periodDays: number,
    includeBudget: boolean,
  ): Promise<InsightDto[]> {
    const overview = await this.getOverview(tenantId, propertyId, periodDays);
    const insights: InsightDto[] = [];

    // --- 1. Bandlik davrlararo o'zgarishi ---
    const occDelta = overview.trend.occupancyRatePctDelta;
    if (
      occDelta !== null &&
      Math.abs(occDelta) >= INSIGHT_THRESHOLDS.metricDeltaPct
    ) {
      const dropped = occDelta < 0;
      insights.push({
        id: 'occupancy-trend',
        severity: dropped ? 'warning' : 'positive',
        title: dropped
          ? `Bandlik ${Math.abs(occDelta)}% pasaydi`
          : `Bandlik ${occDelta}% o'sdi`,
        detail: `Oxirgi ${periodDays} kunda o'rtacha bandlik ${overview.occupancy.occupancyRatePct}% — oldingi ${periodDays} kunga nisbatan ${occDelta > 0 ? '+' : ''}${occDelta}%.`,
        actionLabel: "Bronlarni ko'rish",
        actionTo: '/bookings',
      });
    }

    // --- 2. ADR davrlararo o'zgarishi ---
    const adrDelta = overview.trend.adrDelta;
    if (
      adrDelta !== null &&
      Math.abs(adrDelta) >= INSIGHT_THRESHOLDS.metricDeltaPct
    ) {
      const dropped = adrDelta < 0;
      insights.push({
        id: 'adr-trend',
        severity: dropped ? 'warning' : 'positive',
        title: dropped
          ? `O'rtacha narx (ADR) ${Math.abs(adrDelta)}% pasaydi`
          : `O'rtacha narx (ADR) ${adrDelta}% o'sdi`,
        detail: `Joriy ADR ${Math.round(overview.adr).toLocaleString('uz-UZ')} — oldingi ${periodDays} kunga nisbatan ${adrDelta > 0 ? '+' : ''}${adrDelta}%.`,
        actionLabel: 'Narx rejalari',
        actionTo: '/rooms',
      });
    }

    // --- 3. Budjetdan chetlanish (joriy oy) ---
    if (includeBudget) {
      const now = new Date();
      const perf = await this.getBudgetPerformance(
        tenantId,
        propertyId,
        now.getUTCFullYear(),
      );
      const currentMonth = perf.months.find((m) => m.isPartial);
      const planned = currentMonth?.budget.roomsRevenue ?? null;
      if (currentMonth && planned !== null && planned > 0) {
        // Joriy oy hali tugamagani uchun rejani O'TGAN KUNLAR ulushiga
        // moslashtirib solishtiramiz — aks holda har oyning boshida
        // "rejadan orqadamiz" degan yolg'on ogohlantirish chiqardi.
        const daysInMonth = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
        ).getUTCDate();
        const elapsed = now.getUTCDate();
        const expectedSoFar = (planned * elapsed) / daysInMonth;
        const actual = currentMonth.actual.roomsRevenue;
        const variancePct =
          expectedSoFar > 0
            ? round2(((actual - expectedSoFar) / expectedSoFar) * 100)
            : 0;

        if (Math.abs(variancePct) >= INSIGHT_THRESHOLDS.budgetVariancePct) {
          const behind = variancePct < 0;
          insights.push({
            id: 'budget-variance',
            severity: behind ? 'critical' : 'positive',
            title: behind
              ? `Joriy oy rejasidan ${Math.abs(variancePct)}% orqadasiz`
              : `Joriy oy rejasidan ${variancePct}% oldindasiz`,
            detail: `Oyning ${elapsed}/${daysInMonth} kuni o'tdi. Shu muddatga kutilgan daromad ${Math.round(expectedSoFar).toLocaleString('uz-UZ')}, haqiqiy ${Math.round(actual).toLocaleString('uz-UZ')}.`,
            actionLabel: "Budjetni ko'rish",
            actionTo: '/budget',
          });
        }
      }
    }

    // --- 4. To'lanmagan hisob-fakturalar ---
    if (overview.outstandingInvoices.count > 0) {
      insights.push({
        id: 'outstanding-invoices',
        severity: 'warning',
        title: `${overview.outstandingInvoices.count} ta hisob-faktura to'lanmagan`,
        detail: `Umumiy qoldiq ${Math.round(overview.outstandingInvoices.totalBalance).toLocaleString('uz-UZ')}.`,
        actionLabel: 'Hisob-fakturalar',
        actionTo: '/invoicing',
      });
    }

    // --- 5. Tozalash navbati ---
    const totalRooms = overview.occupancy.totalRooms;
    if (
      totalRooms > 0 &&
      overview.housekeepingPending >
        totalRooms * INSIGHT_THRESHOLDS.housekeepingBacklogRatio
    ) {
      insights.push({
        id: 'housekeeping-backlog',
        severity: 'warning',
        title: `${overview.housekeepingPending} ta tozalash vazifasi kutmoqda`,
        detail: `Bu ${totalRooms} ta xonaning sezilarli qismi — kelayotgan mehmonlarni kutib olishga ulgurmaslik xavfi bor.`,
        actionLabel: 'Housekeeping',
        actionTo: '/housekeeping',
      });
    }

    // --- 6. Ochiq texnik zayavkalar ---
    const openTickets = await this.maintenanceRepo.count({
      where: {
        tenantId,
        propertyId,
        status: In([
          MaintenanceTicketStatus.OPEN,
          MaintenanceTicketStatus.IN_PROGRESS,
        ]),
      },
    });
    if (openTickets > 0) {
      insights.push({
        id: 'open-maintenance',
        severity: openTickets >= 5 ? 'warning' : 'info',
        title: `${openTickets} ta texnik zayavka ochiq`,
        detail:
          'Hal qilinmagan zayavkalar xonani sotuvdan chiqarib turishi mumkin.',
        actionLabel: 'Texnik xizmat',
        actionTo: '/maintenance',
      });
    }

    await this.markDismissed(tenantId, propertyId, userId, insights);

    // Jiddiylik bo'yicha saralaymiz — eng muhimi tepada.
    return insights.sort(
      (a, b) =>
        INSIGHT_SEVERITY_ORDER[a.severity] - INSIGHT_SEVERITY_ORDER[b.severity],
    );
  }

  // Ro'yxatdagi tavsiyalarni foydalanuvchining yopishlariga qarab belgilaydi.
  //
  // Tavsiya YASHIRILADI (dismissed: true), agar:
  //   1. u oxirgi INSIGHT_DISMISSAL_DAYS kun ichida yopilgan bo'lsa, VA
  //   2. hozirgi jiddiyligi yopilgan paytdagidan yomon bo'lmasa.
  //
  // Ikkinchi shart eng muhimi: "2 ta zayavka ochiq" (info) yopilgandan keyin
  // ular 7 taga chiqib `warning`ga aylansa, bu YANGI xabar — uni eski yopish
  // bilan yashirish xavfli bo'lardi.
  private async markDismissed(
    tenantId: string,
    propertyId: string,
    userId: string,
    insights: InsightDto[],
  ): Promise<void> {
    if (insights.length === 0) return;

    const since = new Date(
      Date.now() - INSIGHT_DISMISSAL_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.dismissalRepo.find({
      where: {
        tenantId,
        propertyId,
        userId,
        insightId: In(insights.map((i) => i.id)),
        dismissedAt: MoreThan(since),
      },
    });
    if (rows.length === 0) return;

    const bySeverity = new Map(rows.map((r) => [r.insightId, r.severity]));
    for (const insight of insights) {
      const dismissedAs = bySeverity.get(insight.id);
      if (dismissedAs === undefined) continue;
      // Noma'lum daraja (masalan kelajakda enum kengaysa) — eng past deb
      // qaraymiz, ya'ni har qanday hozirgi daraja "yomonlashish" hisoblanadi
      // va tavsiya ko'rinaveradi. Xatoga qarab YASHIRMASLIK tarafida turamiz.
      const dismissedRank =
        INSIGHT_SEVERITY_ORDER[dismissedAs as InsightSeverity] ??
        Number.POSITIVE_INFINITY;
      if (INSIGHT_SEVERITY_ORDER[insight.severity] >= dismissedRank) {
        insight.dismissed = true;
      }
    }
  }

  // Tavsiyani yopish. Qayta yopilganda yangi qator emas, mavjudi yangilanadi
  // (UNIQUE user+property+insight) — shunda "yopish muddati" har safar
  // noldan boshlanadi.
  async dismissInsight(
    tenantId: string,
    propertyId: string,
    userId: string,
    insightId: string,
    severity: InsightSeverity,
  ): Promise<void> {
    const existing = await this.dismissalRepo.findOne({
      where: { tenantId, propertyId, userId, insightId },
    });
    const dismissedAt = new Date();

    if (existing) {
      existing.severity = severity;
      existing.dismissedAt = dismissedAt;
      await this.dismissalRepo.save(existing);
      return;
    }

    await this.dismissalRepo.save(
      this.dismissalRepo.create({
        tenantId,
        propertyId,
        userId,
        insightId,
        severity,
        dismissedAt,
      }),
    );
  }

  // Yopilganlarni qaytarish. `insightId` berilmasa — shu mulkdagi
  // foydalanuvchining barcha yopishlari tozalanadi ("Hammasini qaytarish").
  async restoreInsights(
    tenantId: string,
    propertyId: string,
    userId: string,
    insightId?: string,
  ): Promise<void> {
    await this.dismissalRepo.delete({
      tenantId,
      propertyId,
      userId,
      ...(insightId ? { insightId } : {}),
    });
  }

  // "Reja vs haqiqat" — Budjet sahifasida kiritilgan oylik rejalarni o'sha
  // oylarning haqiqiy natijasi bilan yonma-yon qaytaradi.
  async getBudgetPerformance(
    tenantId: string,
    propertyId: string,
    year: number,
  ): Promise<BudgetPerformanceDto> {
    const yearStart = `${year}-01-01`;
    // Dekabrning oxirgi kunini ham qamrab olish uchun keyingi yil boshigacha.
    const nextYearStart = `${year + 1}-01-01`;

    const [budgets, totalRooms, bookings] = await Promise.all([
      this.budgetRepo.find({ where: { tenantId, propertyId, year } }),
      this.roomRepo.count({ where: { tenantId, propertyId } }),
      this.bookingRepo.find({
        where: {
          tenantId,
          propertyId,
          checkIn: Between(yearStart, nextYearStart),
          status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        },
      }),
    ]);

    const budgetByMonth = new Map(budgets.map((b) => [b.month, b]));

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1; // 1-12

    // Oy bo'yicha daromad va kecha-xonalarni yig'amiz — getOverview'dagi
    // bilan bir xil: bron o'sha oyda CHECK-IN qilgan bo'lsa shu oyga tegishli.
    const revenueByMonth = new Array<number>(13).fill(0);
    const nightsByMonth = new Array<number>(13).fill(0);
    for (const b of bookings) {
      // checkIn — 'YYYY-MM-DD' matni, oyni to'g'ridan-to'g'ri kesib olamiz
      // (Date orqali o'tkazsak vaqt mintaqasi chegaradagi kunni surib yuborishi mumkin).
      const month = Number(b.checkIn.slice(5, 7));
      if (month < 1 || month > 12) continue;
      revenueByMonth[month] += Number(b.totalAmount);
      nightsByMonth[month] += daysBetween(b.checkIn, b.checkOut);
    }

    const months: BudgetPerformanceMonthDto[] = [];
    for (let month = 1; month <= 12; month++) {
      const isFuture =
        year > currentYear || (year === currentYear && month > currentMonth);
      const isPartial = year === currentYear && month === currentMonth;

      // Nisbiy ko'rsatkichlar (bandlik) uchun maxraj: tugagan oyda — oyning
      // to'liq kunlari, joriy oyda — o'tgan kunlar. Aks holda hali tugamagan
      // oy sun'iy ravishda past bandlik ko'rsatardi.
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const elapsedDays = isPartial ? today.getUTCDate() : daysInMonth;
      const capacityDays = isFuture ? daysInMonth : elapsedDays;

      const revenue = revenueByMonth[month];
      const nights = nightsByMonth[month];

      const budget = budgetByMonth.get(month);
      months.push({
        month,
        budget: {
          roomsRevenue: toNumberOrNull(budget?.roomsRevenue),
          occupancyRatePct: toNumberOrNull(budget?.occupancyRatePct),
          adr: toNumberOrNull(budget?.adr),
        },
        actual: {
          roomsRevenue: round2(revenue),
          occupancyRatePct:
            totalRooms > 0 && capacityDays > 0
              ? round2((nights / (totalRooms * capacityDays)) * 100)
              : 0,
          adr: nights > 0 ? round2(revenue / nights) : 0,
        },
        isPartial,
        isFuture,
      });
    }

    return { year, months };
  }

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
          sourceProfileId: true,
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
    const sourceProfileAgg = new Map<
      string,
      { count: number; revenue: number }
    >();

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

      if (b.sourceProfileId) {
        const sp = sourceProfileAgg.get(b.sourceProfileId) ?? {
          count: 0,
          revenue: 0,
        };
        sp.count += 1;
        sp.revenue += amount;
        sourceProfileAgg.set(b.sourceProfileId, sp);
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

    // Manba profillarining nomlari — FAQAT haqiqatan uchragan ID'lar
    // so'raladi (butun profil jadvalini emas): mehmonxonada minglab mehmon
    // profili bo'lishi mumkin, manbalar esa bir nechta.
    const sourceProfileIds = [...sourceProfileAgg.keys()];
    const sourceProfiles = sourceProfileIds.length
      ? await this.guestRepo.find({
          where: { tenantId, id: In(sourceProfileIds) },
          select: { id: true, fullName: true },
        })
      : [];
    const sourceProfileById = new Map(sourceProfiles.map((g) => [g.id, g]));

    const bySourceProfile = [...sourceProfileAgg.entries()]
      .map(([sourceProfileId, agg]) => ({
        sourceProfileId,
        name: sourceProfileById.get(sourceProfileId)?.fullName ?? "Noma'lum manba",
        bookingCount: agg.count,
        revenue: round2(agg.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      periodDays,
      bySegment,
      bySource,
      byAgency,
      byCorporateAccount,
      bySourceProfile,
    };
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
