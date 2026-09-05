import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Agency } from './agency.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { AgencyCommissionPayment } from './agency-commission-payment.entity';

export enum AgencyCommissionStatus {
  // Hisoblangan, lekin hali to'lanmagan (bosh kitobda 2010 qarzi turibdi).
  ACCRUED = 'accrued',
  // To'langan — qarz yopilgan.
  PAID = 'paid',
}

// Bitta bron uchun hisoblangan turagent komissiyasi. Check-out paytida
// yoziladi (`AgencyCommissionsService.accrueForBooking`) va o'sha zahoti
// bosh kitobga tushadi: debet 5142 (xarajat), kredit 2010 (qarz).
//
// 🔴 `commissionPct` va `baseAmount` — SNAPSHOT. Agentlikning bugungi
// foizini o'zgartirish o'tgan bronlarni qayta hisoblab yubormaydi. Aynan
// shu narsa eski (real vaqtda hisoblanadigan) yechimda buzilgan edi.
//
// Bir bronga faqat bitta qator — `booking_id` bo'yicha UNIQUE indeks
// (migratsiya 1788900000000). Check-out ikki marta yuborilsa ikkinchisi
// jimgina o'tkazib yuboriladi.
@Entity('agency_commissions')
@Unique(['bookingId'])
@Index(['tenantId', 'propertyId', 'agencyId', 'status'])
export class AgencyCommission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne(() => Agency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  // Komissiya hisoblangan summa — bronning XONA narxi (`totalAmount`).
  // Restoran, minibar va boshqa folio qatorlari ATAYLAB kirmaydi
  // (foydalanuvchi qarori, sohadagi odatiy amaliyot).
  @Column({ name: 'base_amount', type: 'numeric', precision: 12, scale: 2 })
  baseAmount: string;

  @Column({ name: 'commission_pct', type: 'numeric', precision: 5, scale: 2 })
  commissionPct: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: AgencyCommissionStatus.ACCRUED })
  status: AgencyCommissionStatus;

  // Provodka sanasi — bronning check-out sanasi (kalendar bugungi kun emas),
  // shunda komissiya xarajati daromad bilan bir davrga tushadi.
  @Column({ name: 'accrued_on', type: 'date' })
  accruedOn: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => AgencyCommissionPayment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment: AgencyCommissionPayment | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
