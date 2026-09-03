import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LEAVE = 'leave', // tasdiqlangan ta'til kuni bilan mos kelishi mumkin (LeaveRequest'dan mustaqil belgilanadi)
  HOLIDAY = 'holiday', // dam olish/bayram kuni
}

// Bitta xodim uchun, bitta kunlik davomat yozuvi — property+xodim+sana bo'yicha
// UNIQUE (bitta kunni ikki marta yozib bo'lmaydi, PUT orqali qayta yuborilsa
// mavjud yozuv yangilanadi). `hoursWorked` asosan HOURLY xodimlar uchun muhim —
// PayrollService.createRun shu yerdan oylik jamlangan soatni oladi (qo'lda
// kiritishga muqobil sifatida, lekin baribir keyin tahrirlash mumkin bo'lib
// qoladi). Davomat operatsion (tuzatilishi mumkin) ma'lumot bo'lgani uchun,
// PayslipEntry'dan farqli, snapshot maydonlar ishlatilmaydi — xodim nomi har
// doim joriy `User` yozuvidan olinadi.
@Entity('attendance_records')
@Index(['tenantId', 'propertyId'])
@Unique(['propertyId', 'userId', 'date'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  // Faqat status=PRESENT/LEAVE (qisman kun) uchun mazmunli — ABSENT/HOLIDAY
  // uchun odatda 0 yoki bo'sh qoladi. HOURLY payroll hisob-kitobi shu maydonga
  // tayanadi.
  @Column({
    name: 'hours_worked',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  hoursWorked: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'recorded_by_user_id', type: 'uuid' })
  recordedByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
