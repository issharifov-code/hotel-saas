import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { FunctionSpace } from './function-space.entity';

export enum FunctionSpaceBookingStatus {
  TENTATIVE = 'tentative', // dastlabki band (hali tasdiqlanmagan)
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

// Bitta tadbir uchun bron — mehmon bronidan (Booking) MUSTAQIL, ataylab
// additive: mavjud check-in/check-out/folio/invoicing zanjiriga hech narsa
// tegilmaydi. totalAmount qo'lda kiritiladi (masalan zal ijarasi + taomnoma),
// avtomatik hisob-faktura hozircha yaratilmaydi.
@Entity('function_space_bookings')
@Index(['tenantId', 'propertyId'])
@Index(['functionSpaceId', 'startTime', 'endTime']) // vaqt to'qnashuvini tekshirish tez ishlashi uchun
export class FunctionSpaceBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'function_space_id', type: 'uuid' })
  functionSpaceId: string;

  @ManyToOne(() => FunctionSpace, (space) => space.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'function_space_id' })
  functionSpace: FunctionSpace;

  @Column({ name: 'event_name', length: 200 })
  eventName: string;

  @Column({ name: 'organizer_name', length: 200 })
  organizerName: string;

  @Column({
    name: 'organizer_phone',
    length: 50,
    nullable: true,
    type: 'varchar',
  })
  organizerPhone: string | null;

  @Column({
    name: 'organizer_email',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  organizerEmail: string | null;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @Column({ name: 'attendee_count', type: 'integer', nullable: true })
  attendeeCount: number | null;

  // Erkin matn (masalan "Teatr", "Banket", "U-shakl") — zal doimiy
  // joylashuv turiga ega emas, har bir tadbir uchun alohida tanlanadi.
  @Column({ name: 'setup_style', length: 100, nullable: true, type: 'varchar' })
  setupStyle: string | null;

  @Column({
    type: 'enum',
    enum: FunctionSpaceBookingStatus,
    default: FunctionSpaceBookingStatus.CONFIRMED,
  })
  status: FunctionSpaceBookingStatus;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalAmount: string | null;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
