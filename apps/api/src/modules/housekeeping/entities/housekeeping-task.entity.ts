import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';

export enum HousekeepingTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  INSPECTED = 'inspected',
  CANCELLED = 'cancelled',
}

// Har bir tozalash vazifasi — yoki check-out'dan keyin avtomatik, yoki qo'lda
// (masalan mehmon turishi davomida qo'shimcha tozalash) yaratiladi.
@Entity('housekeeping_tasks')
@Index(['tenantId', 'propertyId'])
@Index(['tenantId', 'propertyId', 'status']) // kutilayotgan tozalash navbati
export class HousekeepingTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({
    type: 'enum',
    enum: HousekeepingTaskStatus,
    default: HousekeepingTaskStatus.PENDING,
  })
  status: HousekeepingTaskStatus;

  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'inspected_at', type: 'timestamp', nullable: true })
  inspectedAt: Date | null;

  @Column({ name: 'inspected_by_user_id', type: 'uuid', nullable: true })
  inspectedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
