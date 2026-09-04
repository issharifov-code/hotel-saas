import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

export enum InvoicePaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  // To'lov shlyuzi (Payments moduli) orqali qabul qilingan — mock yoki
  // kelajakdagi Payme/Click adapteri. `provider`/`providerRef` maydonlarida
  // qo'shimcha tafsilot saqlanadi.
  ONLINE = 'online',
}

@Entity('invoice_payments')
// Postgres tashqi kalit uchun indeksni AVTOMATIK yaratmaydi — bu jadvalda
// `invoice_id` bo'yicha hech qanday indeks yo'q edi va daromad trendi
// grafigidagi join butun jadvalni skanerlardi. Qarang: AddReportsIndexes.
@Index(['invoiceId', 'createdAt'])
export class InvoicePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: InvoicePaymentMethod })
  method: InvoicePaymentMethod;

  @Column({ name: 'received_by_user_id', type: 'uuid' })
  receivedByUserId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  // ONLINE usulida to'lov qanday provayder (masalan 'mock', kelajakda
  // 'payme'/'click') orqali qayta ishlanganini bildiradi. Qo'lda kiritilgan
  // to'lovlar (cash/card/bank_transfer) uchun har doim null.
  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  // To'lov shlyuzidan qaytgan tashqi tranzaksiya identifikatori (audit va
  // kelajakdagi moslashtirish/qaytarish uchun).
  @Column({
    name: 'provider_ref',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  providerRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
