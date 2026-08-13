import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { RoomType } from './room-type.entity';

export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out_of_order',
}

// Bandlik holatidan (RoomStatus) mustaqil o'lchov: xona tozami yoki yo'qmi.
// Check-out'dan keyin avtomatik DIRTY bo'ladi va Housekeeping xodimi CLEAN
// (yoki INSPECTED) deb belgilamaguncha o'sha xonaga check-in qilib bo'lmaydi.
export enum HousekeepingStatus {
  CLEAN = 'clean',
  DIRTY = 'dirty',
  IN_PROGRESS = 'in_progress',
  INSPECTED = 'inspected',
}

@Entity('rooms')
@Index(['tenantId', 'propertyId'])
@Unique(['propertyId', 'roomNumber'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @ManyToOne(() => RoomType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @Column({ name: 'room_number', length: 20 })
  roomNumber: string;

  @Column({ type: 'int', nullable: true })
  floor: number | null;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.AVAILABLE })
  status: RoomStatus;

  @Column({
    name: 'housekeeping_status',
    type: 'enum',
    enum: HousekeepingStatus,
    default: HousekeepingStatus.CLEAN,
  })
  housekeepingStatus: HousekeepingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
