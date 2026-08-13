import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Warehouse'dagi kabi: MVP uchun property boshiga bitta "Asosiy savdo nuqtasi"
// avtomatik yaratiladi (lazy). Struktura kelajakda bir nechta outlet
// (Restoran/Bar alohida) qo'llab-quvvatlash uchun tayyor.
@Entity('pos_outlets')
@Index(['tenantId', 'propertyId'])
export class PosOutlet {
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
