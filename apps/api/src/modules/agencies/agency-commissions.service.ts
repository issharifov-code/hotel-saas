import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Agency } from './entities/agency.entity';
import {
  AgencyCommission,
  AgencyCommissionStatus,
} from './entities/agency-commission.entity';
import {
  AGENCY_PAYMENT_SYSTEM_KEY,
  AgencyCommissionPayment,
} from './entities/agency-commission-payment.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { AccountingService } from '../accounting/accounting.service';
import { PayAgencyCommissionsDto } from './dto/pay-agency-commissions.dto';

export interface AgencyCommissionSummary {
  agencyId: string;
  commissionPct: string;
  currency: string;
  // Komissiyasi YOZILGAN (check-out qilingan) bronlar
  bookingCount: number;
  totalRevenue: string;
  accruedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  // Eski maydon nomi — frontend deploy'i orqada qolsa buzilmasin uchun
  // saqlandi. Ma'nosi endi aniqroq: "hozir qarzdormiz".
  commissionOwed: string;
  // Hali check-out qilinmagan bronlar — hozirgi foiz bo'yicha KUTILAYOTGAN
  // summa, hech qayerga yozilmagan.
  projectedBookingCount: number;
  projectedAmount: string;
  // Komissiya yozuvi joriy qilinishidan OLDIN yakunlangan bronlar. Ular
  // uchun provodka yo'q (o'tmishga qarzni o'ylab topib yozish noto'g'ri
  // bo'lardi), lekin sahifada nol ko'rsatish ham yolg'on bo'lardi — shuning
  // uchun taxminiy summa alohida ko'rsatiladi.
  historicalBookingCount: number;
  historicalEstimate: string;
}

function round2(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

const OPEN_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

// Turagent komissiyasini bosh kitobga yozadigan servis.
//
// Nima uchun alohida servis: `AgenciesService` — agentlik kartochkasi
// (CRUD). Bu esa moliyaviy operatsiya bo'lib, `AccountingService`ga
// bog'liq. Ikkalasini bitta faylga qo'shsak, oddiy agentlik nomini
// tahrirlash ham buxgalteriya moduliga bog'liq bo'lib qolardi.
@Injectable()
export class AgencyCommissionsService {
  constructor(
    @InjectRepository(AgencyCommission)
    private readonly commissionRepo: Repository<AgencyCommission>,
    @InjectRepository(AgencyCommissionPayment)
    private readonly paymentRepo: Repository<AgencyCommissionPayment>,
    @InjectRepository(Agency) private readonly agencyRepo: Repository<Agency>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly accountingService: AccountingService,
  ) {}

  // Check-out paytida chaqiriladi (BookingsService.checkOut).
  //
  // Idempotent va "jim": agentliksiz bron, 0% komissiya yoki allaqachon
  // yozilgan qator — hech biri xato emas, shunchaki `null` qaytadi.
  // Sabab: komissiya yozuvidagi muammo mehmonni chiqara olmaslikka olib
  // kelmasligi kerak.
  async accrueForBooking(
    tenantId: string,
    propertyId: string,
    booking: Booking,
    manager?: EntityManager,
  ): Promise<AgencyCommission | null> {
    if (!booking.agencyId) return null;

    const commissionRepo = manager
      ? manager.getRepository(AgencyCommission)
      : this.commissionRepo;
    const agencyRepo = manager ? manager.getRepository(Agency) : this.agencyRepo;

    const existing = await commissionRepo.findOne({
      where: { bookingId: booking.id },
    });
    if (existing) return existing;

    const agency = await agencyRepo.findOne({
      where: { id: booking.agencyId, tenantId, propertyId },
    });
    if (!agency) return null;

    const commissionPct = Number(agency.commissionPct);
    // 0% — "net rate" shartnomasi (agentlik o'z ustamasini mehmondan oladi).
    // Bunda qarz ham, xarajat ham yo'q, shuning uchun qator ochilmaydi:
    // aks holda agentlik ro'yxati abadiy nol qatorlar bilan to'lib ketardi.
    if (!(commissionPct > 0)) return null;

    const baseAmount = Number(booking.totalAmount);
    const amount = Number(round2((baseAmount * commissionPct) / 100));

    const commission = await commissionRepo.save(
      commissionRepo.create({
        tenantId,
        propertyId,
        agencyId: agency.id,
        bookingId: booking.id,
        baseAmount: Number(baseAmount).toFixed(2),
        commissionPct: commissionPct.toFixed(2),
        amount: amount.toFixed(2),
        currency: booking.currency,
        status: AgencyCommissionStatus.ACCRUED,
        // Kalendar bugungi kun emas, check-out sanasi — xarajat o'sha
        // daromad bilan bir davrga tushishi uchun.
        accruedOn: booking.checkOut,
      }),
    );

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      entryDate: booking.checkOut,
      description: `Agentlik komissiyasi — bron ${booking.id.slice(0, 8)}`,
      sourceModule: 'agencies',
      sourceId: commission.id,
      debitSystemKey: 'agency_commission_expense',
      creditSystemKey: 'agency_commission_payable',
      amount: commission.amount,
      manager,
    });

    return commission;
  }

  private async findAgency(
    tenantId: string,
    propertyId: string,
    agencyId: string,
  ): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({
      where: { id: agencyId, tenantId, propertyId },
    });
    if (!agency) throw new NotFoundException('Agentlik topilmadi');
    return agency;
  }

  async listByAgency(
    tenantId: string,
    propertyId: string,
    agencyId: string,
    status?: AgencyCommissionStatus,
  ): Promise<AgencyCommission[]> {
    await this.findAgency(tenantId, propertyId, agencyId);
    return this.commissionRepo.find({
      where: { tenantId, propertyId, agencyId, ...(status ? { status } : {}) },
      relations: { booking: true },
      order: { accruedOn: 'DESC', createdAt: 'DESC' },
    });
  }

  async listPayments(
    tenantId: string,
    propertyId: string,
    agencyId: string,
  ): Promise<AgencyCommissionPayment[]> {
    await this.findAgency(tenantId, propertyId, agencyId);
    return this.paymentRepo.find({
      where: { tenantId, propertyId, agencyId },
      order: { paidOn: 'DESC', createdAt: 'DESC' },
    });
  }

  async getSummary(
    tenantId: string,
    propertyId: string,
    agencyId: string,
  ): Promise<AgencyCommissionSummary> {
    const agency = await this.findAgency(tenantId, propertyId, agencyId);
    const commissionPct = Number(agency.commissionPct);

    const [commissions, bookings] = await Promise.all([
      this.commissionRepo.find({ where: { tenantId, propertyId, agencyId } }),
      this.bookingRepo.find({
        where: { tenantId, propertyId, agencyId },
        select: { id: true, status: true, totalAmount: true, currency: true },
      }),
    ]);

    let accrued = 0;
    let paid = 0;
    let revenue = 0;
    const accountedBookingIds = new Set<string>();
    for (const c of commissions) {
      const amount = Number(c.amount);
      accrued += amount;
      if (c.status === AgencyCommissionStatus.PAID) paid += amount;
      revenue += Number(c.baseAmount);
      accountedBookingIds.add(c.bookingId);
    }

    let projectedRevenue = 0;
    let projectedCount = 0;
    let historicalRevenue = 0;
    let historicalCount = 0;
    for (const b of bookings) {
      if (accountedBookingIds.has(b.id)) continue;
      if (OPEN_STATUSES.includes(b.status)) {
        projectedCount += 1;
        projectedRevenue += Number(b.totalAmount);
      } else if (b.status === BookingStatus.CHECKED_OUT) {
        // Yakunlangan, lekin komissiya qatori yo'q — bu bron komissiya
        // yozuvi joriy qilinishidan oldin chiqib ketgan.
        historicalCount += 1;
        historicalRevenue += Number(b.totalAmount);
      }
      // CANCELLED va NO_SHOW — komissiya yo'q (foydalanuvchi qarori).
    }

    return {
      agencyId,
      commissionPct: commissionPct.toFixed(2),
      currency: bookings[0]?.currency ?? 'UZS',
      bookingCount: commissions.length,
      totalRevenue: round2(revenue),
      accruedAmount: round2(accrued),
      paidAmount: round2(paid),
      outstandingAmount: round2(accrued - paid),
      commissionOwed: round2(accrued - paid),
      projectedBookingCount: projectedCount,
      projectedAmount: round2((projectedRevenue * commissionPct) / 100),
      historicalBookingCount: historicalCount,
      historicalEstimate: round2((historicalRevenue * commissionPct) / 100),
    };
  }

  // Agentlikka to'lov — tanlangan komissiya qatorlarini yopadi.
  //
  // `commissionIds` berilmasa, to'lanmagan HAMMASI yopiladi (eng ko'p
  // uchraydigan hol: oy oxirida to'liq hisob-kitob).
  async pay(
    tenantId: string,
    propertyId: string,
    agencyId: string,
    dto: PayAgencyCommissionsDto,
    userId: string | null,
  ): Promise<AgencyCommissionPayment> {
    await this.findAgency(tenantId, propertyId, agencyId);

    const requestedIds = dto.commissionIds;
    // 🔴 2026-09-05 (kod auditi): bu o'qish qulfsiz edi. Ikkita bir
    // vaqtdagi "hammasini to'lash" so'rovi bir xil ACCRUED to'plamni
    // ko'rib, IKKITA to'lov yozuvi va ikkita provodka yaratardi —
    // `agency_commission_payable` manfiyga tushib, agentlikka kassadan
    // ikki barobar pul chiqqandek ko'rinardi. Pastdagi `alreadyPaid`
    // tekshiruvi bunga yordam bermaydi: ikkala so'rov ham qatorlarni
    // hali ACCRUED holatida ko'radi.
    //
    // Yechim `InvoicingService.persistPayment` naqshi bilan bir xil:
    // qatorlarni FOR UPDATE bilan olamiz, shunda ikkinchi so'rov
    // birinchisi tugagunicha kutadi va keyin `alreadyPaid` ga tushadi.
    const qb = this.commissionRepo
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.property_id = :propertyId', { propertyId })
      .andWhere('c.agency_id = :agencyId', { agencyId });
    if (requestedIds?.length) {
      qb.andWhere('c.id IN (:...ids)', { ids: requestedIds });
    } else {
      qb.andWhere('c.status = :status', {
        status: AgencyCommissionStatus.ACCRUED,
      });
    }
    const commissions = await qb.getMany();

    if (requestedIds?.length && commissions.length !== requestedIds.length) {
      throw new BadRequestException(
        "Ba'zi komissiya qatorlari topilmadi yoki boshqa agentlikka tegishli",
      );
    }
    if (commissions.length === 0) {
      throw new BadRequestException("To'lanmagan komissiya yo'q");
    }
    const alreadyPaid = commissions.filter(
      (c) => c.status !== AgencyCommissionStatus.ACCRUED,
    );
    if (alreadyPaid.length > 0) {
      throw new BadRequestException(
        `${alreadyPaid.length} ta komissiya allaqachon to'langan — sahifani yangilang`,
      );
    }

    const total = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        tenantId,
        propertyId,
        agencyId,
        amount: round2(total),
        currency: commissions[0].currency,
        method: dto.method,
        paidOn: dto.paidOn ?? new Date().toISOString().slice(0, 10),
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        createdByUserId: userId,
      }),
    );

    await this.commissionRepo.update(
      { id: In(commissions.map((c) => c.id)) },
      { status: AgencyCommissionStatus.PAID, paymentId: payment.id },
    );

    // Qarz kamayadi (debet 2010), pul chiqadi (kredit kassa/bank).
    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      entryDate: payment.paidOn,
      description: `Agentlikka komissiya to'lovi (${commissions.length} ta bron)`,
      sourceModule: 'agencies',
      sourceId: payment.id,
      createdByUserId: userId,
      debitSystemKey: 'agency_commission_payable',
      creditSystemKey: AGENCY_PAYMENT_SYSTEM_KEY[dto.method],
      amount: payment.amount,
    });

    return payment;
  }
}
