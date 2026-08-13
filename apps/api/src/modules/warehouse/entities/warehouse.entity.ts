import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// MVP: property boshiga bitta "asosiy ombor" avtomatik yaratiladi (lazy, birinchi
// so'rovda). Struktura kelajakda bir nechta ombor nuqtasini (oshxona/bar/housekeeping)
// qo'llab-quvvatlash uchun tayyor.
@Entity('warehouses')
@Index(['tenantId', 'propertyId'])
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'is_default', type: 'boolean', default: true })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
