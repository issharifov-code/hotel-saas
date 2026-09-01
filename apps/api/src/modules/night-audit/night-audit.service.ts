import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { NightAuditRun } from './entities/night-audit-run.entity';
import { Property } from '../properties/entities/property.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { RatePlansService } from '../rooms/rate-plans.service';
import {
  CancellationFeeType,
  RatePlan,
} from '../rooms/entities/rate-plan.entity';
import { InvoicingService } from '../invoicing/invoicing.service';
import {
  PaginatedResult,
  PaginationParams,
} from '../../common/utils/pagination.util';

export interface NightAuditStatusDto {
  businessDate: string;
  pendingNoShows: number;
  lastAuditDate: string | null;
  lastRunAt: Date | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Bir kechalik (checkIn..checkOut oralig'idagi) tunlar sonini hisoblaydi —
// ReportsService.daysBetween bilan bir xil formuladan foydalanadi.
function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Math.max(1, Math.round(ms / 86_400_000));
}

// `T00:00:00.000Z` + UTC getter/setter ATAYLAB ishlatiladi — server qaysi
// vaqt zonasida ishlashidan qat'i nazar sana hisobi doim to'g'ri chiqishi
// uchun (oddiy `new Date(dateIso); d.setDate(...)` mahalliy vaqt zonasiga
// bog'liq bo'lib, UTC'dan orqada turgan zonalarda bir kun xato berishi mumkin edi).
function addOneDay(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Night Audit — mehmonxona PMS'larida standart "kunni yopish" (end-of-day)
// jarayoni. Har bir property o'zining joriy "biznes sanasi"
// (Property.businessDate)ni yuritadi; xodim kun oxirida shu jarayonni
// ishga tushiradi:
//   1. Kelish sanasi (checkIn) allaqachon o'tgan, lekin hali check-in
//      qilinmagan (pending/confirmed holatidagi) bronlar avtomatik "no_show"
//      deb belgilanadi.
//   2. Shu yopilayotgan kecha uchun bandlik/ADR/RevPAR/xona daromadi
//      hisoblanadi va o'zgarmas audit yozuvi (NightAuditRun) sifatida saqlanadi.
//   3. Biznes sanasi bir kunga oldinga suriladi.
// Bu ATAYLAB mavjud xona-narx yozish mexanizmiga (hisob-faktura hamon
// check-in/check-out'da butun turish uchun bir marta yoziladi, InvoicingService
// qarang) tegmaydi — Night Audit alohida, qo'shimcha audit/nazorat qatlami
// sifatida qo'shildi, mavjud billing oqimini buzmaslik uchun.
@Injectable()
export class NightAuditService {
  constructor(
    @InjectRepository(NightAuditRun)
    private readonly runRepo: Repository<NightAuditRun>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    private readonly ratePlansService: RatePlansService,
    private readonly invoicingService: InvoicingService,
  ) {}

  async getStatus(
    tenantId: string,
    propertyId: string,
  ): Promise<NightAuditStatusDto> {
    const property = await this.findProperty(tenantId, propertyId);

    const pendingNoShows = await this.bookingRepo.count({
      where: {
        tenantId,
        propertyId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        checkIn: LessThanOrEqual(property.businessDate),
      },
    });

    const lastRun = await this.runRepo.findOne({
      where: { tenantId, propertyId },
      order: { auditDate: 'DESC' },
    });

    return {
      businessDate: property.businessDate,
      pendingNoShows,
      lastAuditDate: lastRun?.auditDate ?? null,
      lastRunAt: lastRun?.createdAt ?? null,
    };
  }

  async history(
    tenantId: string,
    propertyId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<NightAuditRun>> {
    const [items, total] = await this.runRepo.findAndCount({
      where: { tenantId, propertyId },
      order: { auditDate: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async run(
    tenantId: string,
    propertyId: string,
    userId: string,
  ): Promise<NightAuditRun> {
    const property = await this.findProperty(tenantId, propertyId);
    const auditDate = property.businessDate;

    const already = await this.runRepo.findOne({
      where: { propertyId, auditDate },
    });
    if (already) {
      throw new ConflictException(
        `${auditDate} sanasi uchun Night Audit allaqachon bajarilgan`,
      );
    }

    // 1) No-show: kelish sanasi o'tgan, lekin hali check-in qilinmagan bronlar.
    const noShowCandidates = await this.bookingRepo.find({
      where: {
        tenantId,
        propertyId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        checkIn: LessThanOrEqual(auditDate),
      },
    });
    for (const booking of noShowCandidates) {
      // No-show jarimasi — muddat tekshirilmaydi (bekor qilishdan farqli
      // o'laroq, no-show'ning o'zi allaqachon "kech" holat): agar narx
      // rejasida noShowFeeType/Value sozlangan bo'lsa, jarima avtomatik
      // hisoblanadi va mustaqil hisob-faktura sifatida yoziladi (bu bronlar
      // ham hech qachon check-in qilinmagan, demak oddiy folio yo'q).
      let feeAmount: string | null = null;
      if (booking.ratePlanId) {
        const ratePlan = await this.ratePlansService.findById(
          tenantId,
          propertyId,
          booking.ratePlanId,
        );
        feeAmount = this.calcNoShowFee(booking, ratePlan);
      }

      if (feeAmount && Number(feeAmount) > 0) {
        await this.bookingRepo.update(
          { id: booking.id },
          {
            status: BookingStatus.NO_SHOW,
            cancellationFeeAmount: feeAmount,
          },
        );
        await this.invoicingService.createFeeInvoice(
          tenantId,
          propertyId,
          { ...booking, cancellationFeeAmount: feeAmount },
          `Kelmaslik (no-show) jarimasi — bron ${booking.id.slice(0, 8)}`,
          feeAmount,
          'cancellation_fee_revenue',
        );
      } else {
        await this.bookingRepo.update(
          { id: booking.id },
          { status: BookingStatus.NO_SHOW },
        );
      }
    }

    // 2) Shu yopilayotgan kecha uchun bandlik/ADR/RevPAR/xona daromadi —
    // checkIn <= auditDate < checkOut bo'lgan, haqiqatan turgan/turgan bo'lgan
    // (checked_in/checked_out) bronlar shu kechani "band" qilgan hisoblanadi.
    const totalRooms = await this.roomRepo.count({
      where: { tenantId, propertyId },
    });
    const stayingBookings = await this.bookingRepo.find({
      where: {
        tenantId,
        propertyId,
        status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        checkIn: LessThanOrEqual(auditDate),
        checkOut: MoreThan(auditDate),
      },
      select: { checkIn: true, checkOut: true, totalAmount: true },
    });

    let roomRevenue = 0;
    for (const b of stayingBookings) {
      const nights = nightsBetween(b.checkIn, b.checkOut);
      // Butun turish narxi (totalAmount) tunlar soniga tekis taqsimlanadi —
      // hisob-faktura hamon bir martalik yozuv bo'lgani uchun (Night Audit
      // billing mexanizmini o'zgartirmaydi), bu faqat KPI taxminidir.
      roomRevenue += Number(b.totalAmount) / nights;
    }
    const occupiedRooms = stayingBookings.length;
    const occupancyRatePct =
      totalRooms > 0 ? round2((occupiedRooms / totalRooms) * 100) : 0;
    const adr = occupiedRooms > 0 ? round2(roomRevenue / occupiedRooms) : 0;
    const revPar = totalRooms > 0 ? round2(roomRevenue / totalRooms) : 0;

    const run = await this.runRepo.save(
      this.runRepo.create({
        tenantId,
        propertyId,
        auditDate,
        totalRooms,
        occupiedRooms,
        occupancyRatePct: occupancyRatePct.toFixed(2),
        adr: adr.toFixed(2),
        revPar: revPar.toFixed(2),
        roomRevenue: round2(roomRevenue).toFixed(2),
        noShowsProcessed: noShowCandidates.length,
        runByUserId: userId,
      }),
    );

    // 3) Biznes sanasini bir kunga suramiz.
    await this.propertyRepo.update(
      { id: propertyId },
      { businessDate: addOneDay(auditDate) },
    );

    return run;
  }

  // Narx rejasida no-show jarimasi to'liq sozlanmagan bo'lsa (turi va
  // summasi — ikkalasi ham berilishi shart) — jarima yo'q (null). Sozlangan
  // bo'lsa, summa turi bo'yicha hisoblanadi va bron umumiy summasidan
  // oshib ketmasligi kafolatlanadi.
  private calcNoShowFee(booking: Booking, ratePlan: RatePlan): string | null {
    if (!ratePlan.noShowFeeType || !ratePlan.noShowFeeValue) {
      return null;
    }
    const value = Number(ratePlan.noShowFeeValue);
    const total = Number(booking.totalAmount);
    let amount: number;
    switch (ratePlan.noShowFeeType) {
      case CancellationFeeType.PERCENT_OF_TOTAL:
        amount = (total * value) / 100;
        break;
      case CancellationFeeType.FIRST_NIGHT:
        amount = Number(ratePlan.nightlyPrice);
        break;
      case CancellationFeeType.FLAT:
      default:
        amount = value;
        break;
    }
    return Math.min(amount, total).toFixed(2);
  }

  private async findProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<Property> {
    const property = await this.propertyRepo.findOneBy({
      id: propertyId,
      tenantId,
    });
    if (!property) throw new NotFoundException('Mulk topilmadi');
    return property;
  }
}
