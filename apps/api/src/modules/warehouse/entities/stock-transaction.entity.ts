import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum StockTransactionType {
  RECEIPT = 'receipt', // PO orqali yoki qo'lda kirim
  ISSUE = 'issue', // iste'mol/chiqim (masalan oshxonaga berildi)
  ADJUSTMENT = 'adjustment', // inventarizatsiya tuzatishi (+/-)
}

// Har bir ombor harakati uchun audit-trail yozuvi. quantity har doim musbat,
// yo'nalish `type` orqali aniqlanadi (ADJUSTMENT manfiy bo'lishi mumkin).
@Entity('stock_transactions')
@Index(['tenantId', 'warehouseId', 'stockItemId'])
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ name: 'stock_item_id', type: 'uuid' })
  stockItemId: string;

  @Column({ type: 'enum', enum: StockTransactionType })
  type: StockTransactionType;

  // ADJUSTMENT uchun manfiy bo'lishi mumkin, RECEIPT/ISSUE uchun har doim musbat
  @Column({ type: 'numeric', precision: 14, scale: 3 })
  quantity: string;

  // Ushbu operatsiyaning (FIFO bo'yicha hisoblangan, agar ISSUE bo'lsa) o'rtacha birlik narxi
  @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
  unitCost: string;

  @Column({ name: 'total_cost', type: 'numeric', precision: 14, scale: 2 })
  totalCost: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
