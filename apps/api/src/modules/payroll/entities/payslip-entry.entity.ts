import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SalaryType } from '../../users/entities/user.entity';
import { PayrollRun } from './payroll-run.entity';

// Bitta xodim uchun, bitta payroll run ichidagi hisoblov qatori. Barcha
// "snapshot" maydonlar (employeeNameSnapshot/salaryType/rateSnapshot) run
// yaratilgan paytdagi User qiymatlaridan nusxa olinadi — kelajakda xodimning
// maoshi (yoki ismi) o'zgarsa ham, eski, allaqachon yaratilgan payroll
// yozuvlari o'zgarmay qoladi (buxgalteriya audit-trail printsipi, boshqa
// modullardagi "*Snapshot" naqshiga o'xshab — masalan InvoiceLine).
@Entity('payslip_entries')
@Index(['payrollRunId'])
export class PayslipEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payroll_run_id', type: 'uuid' })
  payrollRunId: string;

  @ManyToOne(() => PayrollRun, (run) => run.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;

  // Xodim keyinchalik o'chirilsa (hozircha tizimda hard-delete yo'q, lekin
  // himoya sifatida) — SET NULL, payslip yozuvi (audit-trail) saqlanib qoladi.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'employee_name_snapshot', length: 200 })
  employeeNameSnapshot: string;

  @Column({ name: 'salary_type', type: 'enum', enum: SalaryType })
  salaryType: SalaryType;

  // MONTHLY uchun — oylik bazaviy maosh; HOURLY uchun — bir soatlik stavka
  // (run yaratilgan paytdagi User.salaryAmount qiymati).
  @Column({ name: 'rate_snapshot', type: 'numeric', precision: 12, scale: 2 })
  rateSnapshot: string;

  // Faqat HOURLY uchun — payroll DRAFT holatida qo'lda kiritiladi (davomat
  // moduli hali yo'qligi sababli). MONTHLY uchun NULL bo'lib qoladi.
  @Column({
    name: 'hours_worked',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  hoursWorked: string | null;

  // MONTHLY: rateSnapshot bilan bir xil. HOURLY: hoursWorked x rateSnapshot.
  @Column({
    name: 'gross_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  grossAmount: string;

  // Ixtiyoriy qo'lda tuzatish — musbat (masalan bonus) yoki manfiy (masalan
  // ushlab qolish/jarima). To'liq soliq/deduksiya hisob-kitobi hali yo'q —
  // bu bitta erkin maydon orqali soddalashtirilgan.
  @Column({
    name: 'adjustment_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  adjustmentAmount: string;

  @Column({
    name: 'adjustment_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  adjustmentNote: string | null;

  // max(0, grossAmount + adjustmentAmount) — manfiy netto bo'lishining oldini
  // oladi (masalan noto'g'ri kiritilgan katta ushlab qolish).
  @Column({
    name: 'net_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  netAmount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
