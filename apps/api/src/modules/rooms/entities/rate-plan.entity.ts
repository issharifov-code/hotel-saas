import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { RoomType } from './room-type.entity';

// Bekor qilish/kelmaslik (no-show) jarimasi qanday hisoblanishini belgilaydi:
// FLAT — belgilangan qat'iy summa; PERCENT_OF_TOTAL — bronning umumiy summasidan
// foiz; FIRST_NIGHT — birinchi kecha narxiga teng (rejaning nightlyPrice'i).
export enum CancellationFeeType {
  FLAT = 'flat',
  PERCENT_OF_TOTAL = 'percent_of_total',
  FIRST_NIGHT = 'first_night',
}

// Narx rejasi (Rate Plan) — bitta xona turi (RoomType) ostida bir nechta narx
// variantini belgilash imkonini beradi (masalan "Rack Rate", "Korporativ
// tarif", "Online tarif", "Qaytarilmaydigan tarif"). Bron yaratilganda foydalanuvchi
// (yoki API) rate plan tanlasa, RoomType.basePrice o'rniga shu rejaning
// nightlyPrice'i ishlatiladi. Rate plan tanlanmasa, avvalgi xulq-atvor
// (RoomType.basePrice * tunlar) o'zgarishsiz qoladi — orqaga mos (backward compatible).
@Entity('rate_plans')
@Index(['tenantId', 'propertyId'])
export class RatePlan {
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

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'nightly_price', type: 'numeric', precision: 12, scale: 2 })
  nightlyPrice: string;

  @Column({ name: 'is_refundable', type: 'boolean', default: true })
  isRefundable: boolean;

  // Faol bo'lmagan rejalar bron yaratishda tanlov ro'yxatida ko'rsatilmaydi,
  // lekin mavjud bronlar (allaqachon shu rejaga bog'langan) buzilmaydi.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  description: string | null;

  // Bekor qilish siyosati (hammasi ixtiyoriy — null bo'lsa, bekor qilish/no-show
  // hech qanday jarimasiz o'tadi, avvalgi xulq-atvor o'zgarishsiz qoladi).
  // cancellationDeadlineDays: check-in sanasidan necha kun oldingacha bepul
  // bekor qilish mumkinligi (masalan 3 — check-in'dan 3 kun oldin bo'lsa jarima
  // yo'q, keyin bo'lsa jarima olinadi). Booking.checkIn/checkOut sana-only
  // (soatsiz) bo'lgani uchun bu ham kunlarda, soatlarda emas.
  @Column({ name: 'cancellation_deadline_days', type: 'int', nullable: true })
  cancellationDeadlineDays: number | null;

  @Column({
    name: 'cancellation_fee_type',
    type: 'enum',
    enum: CancellationFeeType,
    nullable: true,
  })
  cancellationFeeType: CancellationFeeType | null;

  @Column({
    name: 'cancellation_fee_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  cancellationFeeValue: string | null;

  // Kelmaslik (no-show) jarimasi — muddat tekshirilmaydi, Night Audit
  // check-in sanasi o'tib ketgan har qanday no-show uchun qo'llanadi.
  @Column({
    name: 'no_show_fee_type',
    type: 'enum',
    enum: CancellationFeeType,
    nullable: true,
  })
  noShowFeeType: CancellationFeeType | null;

  @Column({
    name: 'no_show_fee_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  noShowFeeValue: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
