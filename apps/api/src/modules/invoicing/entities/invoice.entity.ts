import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Guest } from '../../guests/entities/guest.entity';
import { InvoiceLine } from './invoice-line.entity';
import { InvoicePayment } from './invoice-payment.entity';

export enum InvoiceStatus {
  OPEN = 'open', // mehmon joylashgan, hisobga xarajat qo'shilishi mumkin
  ISSUED = 'issued', // check-out qilingan, yakunlangan (lekin to'liq to'lanmagan bo'lishi mumkin)
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

// Har bir bron uchun bitta "folio" (mehmon hisob-fakturasi) — check-in paytida
// avtomatik ochiladi, xona narxi birinchi qator sifatida qo'shiladi. Turish
// davomida qo'shimcha xarajatlar (POS "xona hisobiga" to'lovlari, qo'lda
// qo'shilgan xizmatlar) shu hisobga qo'shiladi. Check-out paytida "issued"
// holatiga o'tadi (qat'iylashadi), lekin check-out to'lov bilan bog'liq emas —
// to'lanmagan qoldiq keyin kuzatiladi (biznes qoida — tasdiqlangan).
@Entity('invoices')
@Index(['tenantId', 'propertyId'])
@Index(['tenantId', 'propertyId', 'status']) // to'lanmagan hisob-fakturalar
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'booking_id', type: 'uuid', unique: true })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.OPEN })
  status: InvoiceStatus;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: string;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  paidAmount: string;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ name: 'issued_at', type: 'timestamp', nullable: true })
  issuedAt: Date | null;

  @OneToMany(() => InvoiceLine, (line) => line.invoice, { cascade: true })
  lines: InvoiceLine[];

  @OneToMany(() => InvoicePayment, (payment) => payment.invoice, {
    cascade: true,
  })
  payments: InvoicePayment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
