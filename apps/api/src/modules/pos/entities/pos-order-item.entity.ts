import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PosOrder } from './pos-order.entity';
import { MenuItem } from './menu-item.entity';

@Entity('pos_order_items')
export class PosOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => PosOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: PosOrder;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId: string;

  @ManyToOne(() => MenuItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column({ type: 'int' })
  quantity: number;

  // Buyurtma vaqtidagi narx nusxasi (keyinchalik MenuItem narxi o'zgarsa ham chek o'zgarmaydi)
  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
