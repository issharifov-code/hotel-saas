import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Guest } from '../../guests/entities/guest.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { MessageTemplate, MessageChannel } from './message-template.entity';

export enum MessageStatus {
  SENT = 'sent',
  FAILED = 'failed',
}

// Har bir yuborilgan (yoki yuborishga urinilgan) xabarning o'zgarmas audit
// yozuvi — Payments modulidagi ChargeResult/adapter naqshiga o'xshab, haqiqiy
// yuborilgan matn (`body`) shu yerda saqlanadi, shuning uchun shablon
// keyinchalik o'zgartirilsa/o'chirilsa ham tarix buzilmaydi.
@Entity('message_logs')
@Index(['tenantId', 'propertyId'])
@Index(['guestId'])
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  // Ixtiyoriy — bron kontekstida yuborilgan bo'lsa (masalan tasdiqlash
  // xabari), shu bronга bog'lanadi. Bron o'chirilmaydi (hard delete yo'q
  // loyihada), lekin SET NULL xavfsizlik uchun.
  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  // Shablon o'chirilsa ham log qolishi kerak — shuning uchun SET NULL.
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => MessageTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template: MessageTemplate | null;

  @Column({ type: 'enum', enum: MessageChannel })
  channel: MessageChannel;

  @Column({ length: 200, nullable: true, type: 'varchar' })
  subject: string | null;

  @Column({ type: 'varchar', length: 4000 })
  body: string;

  @Column({ type: 'enum', enum: MessageStatus })
  status: MessageStatus;

  // Mock adapter naqshi (Payments'dagi provider/providerRef bilan bir xil) —
  // haqiqiy email/SMS provayder ulanganda shu maydonlar to'ldiriladi.
  @Column({ length: 50, nullable: true, type: 'varchar' })
  provider: string | null;

  @Column({
    name: 'provider_ref',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  providerRef: string | null;

  @Column({
    name: 'failure_reason',
    length: 500,
    nullable: true,
    type: 'varchar',
  })
  failureReason: string | null;

  @Column({ name: 'sent_by_user_id', type: 'uuid' })
  sentByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
