import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Guest } from './guest.entity';

export enum LoyaltyTransactionType {
  EARN = 'earn', // to'lov asosida avtomatik topilgan ball
  REDEEM = 'redeem', // mehmon tomonidan sarflangan ball (kelajakda: sovg'a/chegirma almashtirish)
  ADJUST = 'adjust', // xodim tomonidan qo'lda tuzatish (musbat yoki manfiy)
}

// Har bir ball o'zgarishi shu jadvalga audit yozuvi sifatida tushadi — Guest.loyaltyPoints/
// lifetimePoints faqat shu tranzaksiyalar orqali (LoyaltyService.applyPointsChange) o'zgaradi,
// hech qachon to'g'ridan-to'g'ri emas. `tenant_id`si yo'q — guest_id -> guests orqali
// tenant'ga bog'liq "farzand" jadval (accounting'dagi journal_entry_lines naqshiga o'xshash).
@Entity('loyalty_transactions')
@Index(['guestId'])
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ type: 'enum', enum: LoyaltyTransactionType })
  type: LoyaltyTransactionType;

  // Musbat = qo'shilgan ball, manfiy = ayirilgan (redeem yoki manfiy adjust).
  @Column({ type: 'int' })
  points: number;

  @Column({ length: 255 })
  reason: string;

  // To'lov orqali avtomatik topilgan ball uchun — qaysi hisob-fakturaga bog'liq (audit uchun).
  @Column({ name: 'related_invoice_id', type: 'uuid', nullable: true })
  relatedInvoiceId: string | null;

  // Qo'lda tuzatish (ADJUST) qilgan xodim — EARN uchun null.
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
