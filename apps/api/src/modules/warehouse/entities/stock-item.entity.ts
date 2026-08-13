import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Ombor tovarlar katalogi (masalan: "Osh guruchi", "Sochiq", "Minerall suv 0.5L").
// Narx bu yerda saqlanmaydi — narx faqat kirim (StockLot) darajasida FIFO uchun.
@Entity('stock_items')
@Index(['tenantId'])
@Unique(['tenantId', 'sku'])
export class StockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  // O'lchov birligi: kg, litr, dona, quti va h.k. (erkin matn, MVP uchun)
  @Column({ type: 'varchar', length: 20 })
  unit: string;

  // USALI departamental xarajat toifasi bilan bog'lash uchun (kelajakda Accounting
  // moduliga integratsiya) — hozircha erkin matn.
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'reorder_point', type: 'numeric', precision: 12, scale: 3, default: 0 })
  reorderPoint: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
