import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { FunctionSpaceBooking } from './function-space-booking.entity';

// Function Space / Events — mehmonxonaning banket zali, konferensiya xonasi
// yoki boshqa tadbir maydoni (mehmon yotoq xonalaridan MUSTAQIL — Room/
// RoomType'ga hech qanday aloqasi yo'q, chunki ularning holat modeli
// (checked_in/checked_out, housekeeping) tadbir zaliga mos kelmaydi).
@Entity('function_spaces')
@Index(['tenantId', 'propertyId'])
export class FunctionSpace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'integer' })
  capacity: number;

  // Zalning bir kunlik/tadbirlik ijara narxi (soatlik emas — mehmonxona
  // amaliyotida banket zallar odatda kunlik/tadbirlik tarifda ijaraga
  // beriladi). Har bir bron o'z totalAmount'ini alohida saqlaydi — bu
  // faqat standart/boshlang'ich taklif narxi.
  @Column({
    name: 'daily_rate',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  dailyRate: string;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => FunctionSpaceBooking, (booking) => booking.functionSpace)
  bookings: FunctionSpaceBooking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
