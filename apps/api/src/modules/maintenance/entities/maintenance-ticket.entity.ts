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

export enum MaintenanceTicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MaintenanceTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

// Texnik xizmat so'rovi (masalan konditsioner ishlamayapti, santexnika muammosi)
// — Housekeeping'dagi HousekeepingTask'ga o'xshash naqsh, lekin mustaqil modul:
// "tozalik" emas, "ta'mirlash kerak" holatini kuzatadi. So'rov ochilganda,
// agar xona hozir AVAILABLE bo'lsa, u avtomatik MAINTENANCE holatiga o'tadi
// (band bo'lmagan xonaga yangi bron qilib bo'lmaydi) — hal qilingach/bekor
// qilingach, agar boshqa ochiq so'rov qolmagan bo'lsa, AVAILABLE'ga qaytadi.
@Entity('maintenance_tickets')
@Index(['tenantId', 'propertyId'])
export class MaintenanceTicket {
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

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: MaintenanceTicketPriority,
    default: MaintenanceTicketPriority.MEDIUM,
  })
  priority: MaintenanceTicketPriority;

  @Column({
    type: 'enum',
    enum: MaintenanceTicketStatus,
    default: MaintenanceTicketStatus.OPEN,
  })
  status: MaintenanceTicketStatus;

  @Column({ name: 'reported_by_user_id', type: 'uuid' })
  reportedByUserId: string;

  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({
    name: 'resolution_notes',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  resolutionNotes: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
