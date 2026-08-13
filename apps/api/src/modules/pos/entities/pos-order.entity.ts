import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PosOrderItem } from './pos-order-item.entity';

export enum PosOrderStatus {
  OPEN = 'open',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum PosPaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  ROOM_ACCOUNT = 'room_account', // mehmonning ochiq folio'siga (Invoicing) yoziladi
}

// Naqd/karta — darhol to'langan hisoblanadi. "room_account" — pul olinmaydi,
// buyurtma summasi mehmonning ochiq hisob-fakturasiga (Invoicing moduli) qo'shiladi
// va u yerda keyinroq to'lanadi (booking check-in qilingan bo'lishi shart).
@Entity('pos_orders')
@Index(['tenantId', 'propertyId'])
export class PosOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId: string;

  @Column({ type: 'enum', enum: PosOrderStatus, default: PosOrderStatus.OPEN })
  status: PosOrderStatus;

  @Column({ name: 'table_number', type: 'varchar', length: 20, nullable: true })
  tableNumber: string | null;

  // Ixtiyoriy: kim uchun buyurtma (billing emas, faqat izoh/kuzatuv uchun)
  @Column({ name: 'guest_id', type: 'uuid', nullable: true })
  guestId: string | null;

  // "room_account" to'lovida qaysi bron folio'siga yozilganini bildiradi.
  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @Column({ name: 'payment_method', type: 'enum', enum: PosPaymentMethod, nullable: true })
  paymentMethod: PosPaymentMethod | null;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @OneToMany(() => PosOrderItem, (item) => item.order, { cascade: true })
  items: PosOrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
