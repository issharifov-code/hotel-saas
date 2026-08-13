import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StockLot } from './entities/stock-lot.entity';
import { StockTransaction, StockTransactionType } from './entities/stock-transaction.entity';
import { StockItem } from './entities/stock-item.entity';
import { IssueStockDto } from './dto/issue-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

export interface StockLevelRow {
  stockItemId: string;
  sku: string;
  name: string;
  unit: string;
  reorderPoint: string;
  quantityOnHand: string;
  belowReorderPoint: boolean;
}

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockLot) private readonly lotRepo: Repository<StockLot>,
    @InjectRepository(StockTransaction) private readonly transactionRepo: Repository<StockTransaction>,
    @InjectRepository(StockItem) private readonly stockItemRepo: Repository<StockItem>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // PO qabul qilinganda (yoki qo'lda kirim qilinganda) yangi partiya (lot) yaratadi
  // va RECEIPT tranzaksiyasini yozadi. `manager` berilsa (masalan PurchaseOrdersService.receive
  // o'z transaction'i ichidan chaqirganda), o'sha manager orqali yoziladi — shu bilan
  // PO band yangilanishi bilan bitta atomik transaction'da qoladi.
  async receiveLot(params: {
    tenantId: string;
    warehouseId: string;
    stockItemId: string;
    quantity: string;
    unitCost: string;
    purchaseOrderId?: string | null;
    createdByUserId?: string | null;
    transactionType?: StockTransactionType;
    referenceType?: string;
    notes?: string | null;
    manager?: EntityManager;
  }): Promise<{ lot: StockLot; transaction: StockTransaction }> {
    const lotRepo = params.manager ? params.manager.getRepository(StockLot) : this.lotRepo;
    const transactionRepo = params.manager
      ? params.manager.getRepository(StockTransaction)
      : this.transactionRepo;

    const lot = lotRepo.create({
      tenantId: params.tenantId,
      warehouseId: params.warehouseId,
      stockItemId: params.stockItemId,
      purchaseOrderId: params.purchaseOrderId ?? null,
      quantityReceived: params.quantity,
      quantityRemaining: params.quantity,
      unitCost: params.unitCost,
      receivedAt: new Date(),
    });
    const savedLot = await lotRepo.save(lot);

    const transaction = await transactionRepo.save(
      transactionRepo.create({
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        stockItemId: params.stockItemId,
        type: params.transactionType ?? StockTransactionType.RECEIPT,
        quantity: params.quantity,
        unitCost: params.unitCost,
        totalCost: (Number(params.quantity) * Number(params.unitCost)).toFixed(2),
        referenceType:
          params.referenceType ?? (params.purchaseOrderId ? 'purchase_order' : 'manual_receipt'),
        referenceId: params.purchaseOrderId ?? null,
        notes: params.notes ?? null,
        createdByUserId: params.createdByUserId ?? null,
      }),
    );

    return { lot: savedLot, transaction };
  }

  // FIFO chiqim: eng eski partiyalardan boshlab so'raldigan miqdorni yechadi.
  // Yetarli zaxira bo'lmasa butun operatsiya bekor qilinadi (transaction rollback).
  async issue(
    tenantId: string,
    warehouseId: string,
    dto: IssueStockDto,
    userId?: string | null,
  ): Promise<StockTransaction> {
    const requestedQty = Number(dto.quantity);
    if (!(requestedQty > 0)) {
      throw new BadRequestException("Chiqim miqdori musbat bo'lishi kerak");
    }

    await this.stockItemRepo.findOneByOrFail({ id: dto.stockItemId, tenantId }).catch(() => {
      throw new NotFoundException('Tovar topilmadi');
    });

    return this.dataSource.transaction(async (manager) => {
      const lots = await manager
        .getRepository(StockLot)
        .createQueryBuilder('lot')
        .where('lot.tenant_id = :tenantId', { tenantId })
        .andWhere('lot.warehouse_id = :warehouseId', { warehouseId })
        .andWhere('lot.stock_item_id = :stockItemId', { stockItemId: dto.stockItemId })
        .andWhere('lot.quantity_remaining > 0')
        .orderBy('lot.received_at', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      let remaining = requestedQty;
      let totalCost = 0;
      const updatedLots: StockLot[] = [];

      for (const lot of lots) {
        if (remaining <= 0) break;
        const available = Number(lot.quantityRemaining);
        const consumed = Math.min(available, remaining);
        lot.quantityRemaining = (available - consumed).toFixed(3);
        totalCost += consumed * Number(lot.unitCost);
        remaining -= consumed;
        updatedLots.push(lot);
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Omborda yetarli zaxira yo'q (so'ralgan: ${requestedQty}, yetishmayapti: ${remaining.toFixed(3)})`,
        );
      }

      await manager.save(StockLot, updatedLots);

      const avgUnitCost = totalCost / requestedQty;

      return manager.save(
        StockTransaction,
        manager.getRepository(StockTransaction).create({
          tenantId,
          warehouseId,
          stockItemId: dto.stockItemId,
          type: StockTransactionType.ISSUE,
          quantity: requestedQty.toFixed(3),
          unitCost: avgUnitCost.toFixed(4),
          totalCost: totalCost.toFixed(2),
          referenceType: dto.referenceType ?? 'manual_issue',
          referenceId: dto.referenceId ?? null,
          notes: dto.notes ?? null,
          createdByUserId: userId ?? null,
        }),
      );
    });
  }

  // Inventarizatsiya tuzatishi: musbat (ortiqcha topildi, yangi lot sifatida qo'shiladi,
  // narxi 0 — moliyaviy ta'sirsiz hisoblanadi hozircha) yoki manfiy (yo'qotish, FIFO bo'yicha yechiladi).
  async adjust(
    tenantId: string,
    warehouseId: string,
    dto: AdjustStockDto,
    userId?: string | null,
  ): Promise<StockTransaction> {
    const qty = Number(dto.quantity);
    if (qty === 0) {
      throw new BadRequestException("Tuzatish miqdori 0 bo'lishi mumkin emas");
    }

    if (qty > 0) {
      const { transaction } = await this.receiveLot({
        tenantId,
        warehouseId,
        stockItemId: dto.stockItemId,
        quantity: qty.toFixed(3),
        unitCost: '0',
        createdByUserId: userId,
        transactionType: StockTransactionType.ADJUSTMENT,
        referenceType: 'inventory_adjustment',
        notes: dto.reason,
      });
      return transaction;
    }

    // Manfiy tuzatish — FIFO bo'yicha yechish (issue bilan bir xil mexanizm)
    const issued = await this.issue(
      tenantId,
      warehouseId,
      { stockItemId: dto.stockItemId, quantity: Math.abs(qty).toFixed(3), notes: dto.reason },
      userId,
    );
    issued.type = StockTransactionType.ADJUSTMENT;
    issued.referenceType = 'inventory_adjustment';
    issued.quantity = qty.toFixed(3); // manfiy ko'rsatish uchun
    return this.transactionRepo.save(issued);
  }

  async getStockLevels(tenantId: string, warehouseId: string): Promise<StockLevelRow[]> {
    const rows = await this.lotRepo
      .createQueryBuilder('lot')
      .select('lot.stock_item_id', 'stockItemId')
      .addSelect('SUM(lot.quantity_remaining)', 'quantityOnHand')
      .where('lot.tenant_id = :tenantId', { tenantId })
      .andWhere('lot.warehouse_id = :warehouseId', { warehouseId })
      .groupBy('lot.stock_item_id')
      .getRawMany<{ stockItemId: string; quantityOnHand: string }>();

    const items = await this.stockItemRepo.find({ where: { tenantId } });
    const onHandByItem = new Map(rows.map((r) => [r.stockItemId, r.quantityOnHand]));

    return items.map((item) => {
      const quantityOnHand = onHandByItem.get(item.id) ?? '0';
      return {
        stockItemId: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        reorderPoint: item.reorderPoint,
        quantityOnHand,
        belowReorderPoint: Number(quantityOnHand) < Number(item.reorderPoint),
      };
    });
  }

  async listTransactions(tenantId: string, warehouseId: string, stockItemId?: string): Promise<StockTransaction[]> {
    return this.transactionRepo.find({
      where: stockItemId ? { tenantId, warehouseId, stockItemId } : { tenantId, warehouseId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
