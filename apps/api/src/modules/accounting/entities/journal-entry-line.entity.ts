import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { Account } from './account.entity';

// Har bir qator debet YOKI kredit (ikkalasi emas) bo'ladi — AccountingService
// tomonidan yaratilishda tekshiriladi. tenant_id'ga ega emas (ota JournalEntry
// orqali RLS bilan himoyalanadi — qarang: EnableAccountingRls migratsiyasi).
@Entity('journal_entry_lines')
export class JournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntry;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  debit: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  credit: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
