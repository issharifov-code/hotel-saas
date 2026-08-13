import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Tenant darajasidagi menyu katalogi (StockItem'ga o'xshash). MVP: ombor bilan
// avtomatik bog'lanish yo'q — narx shu yerda belgilanadi, tannarx hisoblanmaydi.
@Entity('menu_items')
@Index(['tenantId'])
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
