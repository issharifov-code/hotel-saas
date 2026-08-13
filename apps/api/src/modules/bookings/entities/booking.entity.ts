import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Guest } from '../../guests/entities/guest.entity';

export enum BookingStatus {
  PENDING = 'pending', // hali tasdiqlanmagan (masalan to'lov kutilmoqda)
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum BookingSource {
  DIRECT = 'direct', // resepshn/telefon orqali to'g'ridan-to'g'ri bron
  WEBSITE = 'website',
  OTA = 'ota', // Booking.com va h.k.
  EXELY = 'exely', // migratsiya/parallel integratsiya davri uchun
}

@Entity('bookings')
@Index(['tenantId', 'propertyId'])
@Index(['roomId', 'checkIn', 'checkOut']) // band vaqt oralig'ini tekshirish tez ishlashi uchun
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Column({ type: 'enum', enum: BookingSource, default: BookingSource.DIRECT })
  source: BookingSource;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ length: 3 })
  currency: string;

  // Exely (yoki boshqa tashqi PMS) bron ID'si — migratsiya/dedupe uchun.
  @Column({ name: 'external_ref', length: 100, nullable: true, type: 'varchar' })
  externalRef: string | null;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
