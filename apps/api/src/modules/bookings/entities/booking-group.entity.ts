import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';

// Guruh/blok bron — korporativ mijoz yoki turizm agentligi bir vaqtning
// o'zida bir nechta xonani bir "guruh" nomi ostida bron qiladi (masalan
// konferensiya, to'y, sport jamoasi). Har bir xona alohida oddiy `Booking`
// yozuvi sifatida yaratiladi (check-in/check-out/folio mantig'i o'zgarmaydi),
// faqat `Booking.groupId` orqali shu guruhga bog'lanadi — bu ATAYLAB additive
// qaror: mavjud invoicing/folio zanjiriga hech narsa tegilmaydi.
@Entity('booking_groups')
@Index(['tenantId', 'propertyId'])
export class BookingGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'group_name', length: 200 })
  groupName: string;

  @Column({
    name: 'company_name',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  companyName: string | null;

  @Column({
    name: 'contact_name',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    length: 50,
    nullable: true,
    type: 'varchar',
  })
  contactPhone: string | null;

  @Column({
    name: 'contact_email',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  contactEmail: string | null;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => Booking, (booking) => booking.group)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
