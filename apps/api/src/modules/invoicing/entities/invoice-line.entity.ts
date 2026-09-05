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

export enum InvoiceLineSource {
  ROOM_CHARGE = 'room_charge', // check-in paytida avtomatik qo'shiladigan xona narxi
  POS_ORDER = 'pos_order', // POS'dan "xona hisobiga" yozilgan buyurtma
  MANUAL = 'manual', // xodim qo'lda qo'shgan qo'shimcha xarajat (minibar, zarar va h.k.)
  ADJUSTMENT = 'adjustment', // Front Desk: xona almashtirish yoki sana o'zgartirish natijasida narx farqi (musbat/manfiy)
  // 🔴 2026-09-05: jarima ilgari `adjustment` bilan yozilardi, lekin u
  // `cancellation_fee_revenue` ni kreditlaydi, `adjustment` esa
  // `room_revenue` ni. Bitta tur ikki xil daromad hisobiga ishlatilgani
  // uchun bekor qilishdagi teskari yozuv noto'g'ri hisobga tushardi.
  CANCELLATION_FEE = 'cancellation_fee', // bekor qilish / no-show jarimasi
}

// ⚡ Ota kalit bo'yicha indeks (2026-09-05, AddChildTableIndexes).
// PostgreSQL FK uchun indeksni o'zi yaratmaydi, ya'ni "shu
// hisob-fakturaning qatorlari" so'rovi butun jadvalni skanerlardi
// (o'lchov: 9.01 ms -> 0.13 ms, 120 000 qatorda). `createdAt` ikkinchi
// ustun: qatorlar har doim shu tartibda o'qiladi.
@Index(['invoiceId', 'createdAt'])
@Entity('invoice_lines')
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'enum', enum: InvoiceLineSource, default: InvoiceLineSource.MANUAL })
  source: InvoiceLineSource;

  // Manba hujjat ID'si (masalan pos_orders.id) — audit-trail uchun, ixtiyoriy.
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 1 })
  quantity: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
