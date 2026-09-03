import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LeaveType {
  VACATION = 'vacation',
  SICK = 'sick',
  UNPAID = 'unpaid',
  OTHER = 'other',
}

export enum LeaveRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

// Xodimning ta'til/kasallik/ish haqisiz ruxsat so'rovi — PENDING holatida
// yaratiladi, PermissionModule.PAYROLL:approve huquqiga ega xodim (Egasi/
// Buxgalter) tomonidan tasdiqlanadi yoki rad etiladi. Hozircha PayrollService
// bilan avtomatik bog'lanmagan (masalan tasdiqlangan UNPAID ta'til uchun
// avtomatik maosh ushlab qolish YO'Q) — bu ataylab qoldirilgan, kelajakdagi
// kengaytma.
@Entity('leave_requests')
@Index(['tenantId', 'propertyId'])
export class LeaveRequest {
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

  @Column({ name: 'leave_type', type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  @Column({ name: 'decided_by_user_id', type: 'uuid', nullable: true })
  decidedByUserId: string | null;

  @Column({ name: 'decided_at', type: 'timestamp', nullable: true })
  decidedAt: Date | null;

  @Column({
    name: 'decision_notes',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  decisionNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
