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

// Xona turi (masalan "Standart", "Delux", "Suite") — narx va sig'im shu darajada belgilanadi.
@Entity('room_types')
@Index(['tenantId', 'propertyId'])
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2 })
  basePrice: string; // pul miqdorlari numeric(12,2) sifatida — float xatoliklarining oldini olish uchun

  @Column({ name: 'max_occupancy', type: 'int', default: 2 })
  maxOccupancy: number;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
