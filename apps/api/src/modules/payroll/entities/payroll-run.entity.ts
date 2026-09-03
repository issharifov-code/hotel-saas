import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PayslipEntry } from './payslip-entry.entity';

export enum PayrollRunStatus {
  DRAFT = 'draft', // hisoblanmoqda — soatlar/tuzatishlar tahrirlanishi mumkin
  FINALIZED = 'finalized', // yakunlangan — xarajat+majburiyat provodkasi yozilgan, endi tahrirlanmaydi
  PAID = 'paid', // to'langan — majburiyat kassadan yopilgan
}

// Bitta oylik "payroll ishga tushirish" — property+yil+oy bo'yicha UNIQUE
// (bitta oyni ikki marta yopib bo'lmaydi). DRAFT holatida yaratilganda
// PayrollService.createRun barcha faol, maoshi belgilangan xodimlar uchun
// avtomatik PayslipEntry qatorlarini hosil qiladi.
@Entity('payroll_runs')
@Index(['tenantId', 'propertyId'])
@Unique(['propertyId', 'periodYear', 'periodMonth'])
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  // 1-12
  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  @Column({
    type: 'enum',
    enum: PayrollRunStatus,
    default: PayrollRunStatus.DRAFT,
  })
  status: PayrollRunStatus;

  // Barcha payslip_entries.net_amount yig'indisi — har bir tahrirdan keyin
  // PayrollService tomonidan qayta hisoblab yoziladi (denormalized, tez
  // ro'yxat ko'rinishi uchun).
  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: string;

  @Column({ name: 'run_by_user_id', type: 'uuid' })
  runByUserId: string;

  @Column({ name: 'finalized_by_user_id', type: 'uuid', nullable: true })
  finalizedByUserId: string | null;

  @Column({ name: 'finalized_at', type: 'timestamp', nullable: true })
  finalizedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => PayslipEntry, (entry) => entry.payrollRun, { cascade: true })
  entries: PayslipEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
