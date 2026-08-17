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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
