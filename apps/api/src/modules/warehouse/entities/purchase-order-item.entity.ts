import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { StockItem } from './stock-item.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'stock_item_id', type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column({ name: 'quantity_ordered', type: 'numeric', precision: 14, scale: 3 })
  quantityOrdered: string;

  // Har safar qisman qabul qilinganda oshib boradi; quantityOrdered'ga yetganda PO to'liq qabul qilingan hisoblanadi
  @Column({ name: 'quantity_received', type: 'numeric', precision: 14, scale: 3, default: 0 })
  quantityReceived: string;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
  unitCost: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
