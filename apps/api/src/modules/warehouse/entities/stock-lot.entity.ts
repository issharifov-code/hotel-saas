import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// FIFO baholash uchun har bir kirim (partiya) alohida yozuv sifatida saqlanadi.
// Chiqim (issue) qilinganda eng eski (receivedAt bo'yicha) partiyalardan boshlab
// quantityRemaining kamaytiriladi.
@Entity('stock_lots')
@Index(['tenantId', 'warehouseId', 'stockItemId', 'receivedAt'])
export class StockLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ name: 'stock_item_id', type: 'uuid' })
  stockItemId: string;

  // Qaysi xarid buyurtmasidan kelgani (bo'lishi mumkin emas — qo'lda kirim ham bo'lishi mumkin)
  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId: string | null;

  @Column({ name: 'quantity_received', type: 'numeric', precision: 14, scale: 3 })
  quantityReceived: string;

  @Column({ name: 'quantity_remaining', type: 'numeric', precision: 14, scale: 3 })
  quantityRemaining: string;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
  unitCost: string;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
