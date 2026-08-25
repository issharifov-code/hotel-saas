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

// Har bir Night Audit ("kunni yopish") ishga tushirilishining o'zgarmas audit
// yozuvi — bitta property, bitta audit_date uchun faqat bitta marta bo'ladi
// (UNIQUE constraint orqali DB darajasida ham himoyalangan — bir kunni ikki
// marta yopib bo'lmaydi, NightAuditService bu ustiga qo'shimcha aniq
// tekshiruv ham qiladi, foydalanuvchiga tushunarli xato xabari uchun).
@Entity('night_audit_runs')
@Index(['tenantId', 'propertyId'])
@Unique(['propertyId', 'auditDate'])
export class NightAuditRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  // Yopilgan biznes sanasi — shu qiymatdan property.businessDate ertasi
  // kunga suriladi (NightAuditService.run ichida).
  @Column({ name: 'audit_date', type: 'date' })
  auditDate: string;

  @Column({ name: 'total_rooms', type: 'int' })
  totalRooms: number;

  @Column({ name: 'occupied_rooms', type: 'int' })
  occupiedRooms: number;

  @Column({
    name: 'occupancy_rate_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  occupancyRatePct: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  adr: string;

  @Column({ name: 'rev_par', type: 'numeric', precision: 12, scale: 2 })
  revPar: string;

  @Column({ name: 'room_revenue', type: 'numeric', precision: 12, scale: 2 })
  roomRevenue: string;

  // Shu audit chaqirilganda avtomatik "no_show" deb belgilangan bronlar soni
  // (kelish sanasi o'tib ketgan, lekin check-in qilinmagan pending/confirmed bronlar).
  @Column({ name: 'no_shows_processed', type: 'int', default: 0 })
  noShowsProcessed: number;

  @Column({ name: 'run_by_user_id', type: 'uuid' })
  runByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
