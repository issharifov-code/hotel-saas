import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalEntryLine } from './journal-entry-line.entity';

// Yozuv qaysi modul/harakat orqali avtomatik yaratilganini bildiradi (audit-trail).
// 'manual' — buxgalter tomonidan qo'lda kiritilgan yozuv.
export type JournalEntrySourceModule = 'invoicing' | 'pos' | 'warehouse' | 'manual';

// Bosh kitob yozuvi (jurnal yozuvi boshi). Bitta yozuv >=2 qatorga (JournalEntryLine)
// ega, va har doim debet jami = kredit jami (AccountingService.postJournalEntry
// tomonidan tekshiriladi). Yozuvlar O'ZGARTIRILMAYDI/O'CHIRILMAYDI — tuzatish faqat
// yangi teskari (reversal) yozuv orqali (buxgalteriya audit-trail printsipiga mos).
@Entity('journal_entries')
@Index(['tenantId', 'propertyId'])
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'source_module', type: 'varchar', length: 20 })
  sourceModule: JournalEntrySourceModule;

  // Manba hujjat ID'si (masalan invoices.id, pos_orders.id, purchase_orders.id) —
  // audit-trail va (kelajakda) avtomatik teskari yozuv uchun.
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => JournalEntryLine, (line) => line.journalEntry, { cascade: true })
  lines: JournalEntryLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
