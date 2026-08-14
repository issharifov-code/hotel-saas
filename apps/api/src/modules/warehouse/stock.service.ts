import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { StockLot } from './entities/stock-lot.entity';
import { StockTransaction, StockTransactionType } from './entities/stock-transaction.entity';
import { StockItem } from './entities/stock-item.entity';
import { IssueStockDto } from './dto/issue-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AccountingService } from '../accounting/accounting.service';

export interface StockLevelRow {
  stockItemId: string;
  sku: string;
  name: string;
  unit: string;
  reorderPoint: string;
  quantityOnHand: string;
  belowReorderPoint: boolean;
}

// StockItem.category matnida shu kalit so'zlardan biri uchrasa, F&B tannarxi
// hisobiga o'tkaziladi — aks holda umumiy (masalan housekeeping/rooms) xarajat
// hisobiga. Bu StockItem'da hali alohida "departament" maydoni yo'qligi sababli
// qo'llaniladigan soddalashtirilgan evristika (kelajakda aniq maydon bilan
// almashtirilishi mumkin).
const FB_CATEGORY_KEYWORDS = ['food', 'oziq', 'ichimlik', 'bar', 'restoran', 'oshxona', 'kitchen', 'f&b', 'fb'];

function classifyExpenseSystemKey(category: string | null): string {
  if (category && FB_CATEGORY_KEYWORDS.some((kw) => category.toLowerCase().includes(kw))) {
    return 'cogs_fb';
  }
  return 'general_supplies_expense';
}

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockLot) private readonly lotRepo: Repository<StockLot>,
    @InjectRepository(StockTransaction) private readonly transactionRepo: Repository<StockTransaction>,
    @InjectRepository(StockItem) private readonly stockItemRepo: Repository<StockItem>,
    private readonly accountingService: AccountingService,
  ) {}

  // PO qabul qilinganda (yoki qo'lda kirim qilinganda) yangi partiya (lot) yaratadi
  // va RECEIPT tranzaksiyasini yozadi. `manager` berilsa (masalan PurchaseOrdersService.receive
  // o'z so'rov-transaction'i ichidan chaqirganda), o'sha manager orqali yoziladi.
  // Agar berilmasa, shu servisning REQUEST-scoped (RLS bilan tenant kontekstiga ega)
  // repository'laridan foydalaniladi — bularning barchasi allaqachon BITTA so'rov
  // tranzaksiyasi ichida (RlsContextService orqali) ishlaydi, shuning uchun bu yerda
  // qo'shimcha `dataSource.transaction()` ochish SHART EMAS (aksincha, xato — alohida,
  // tenant konteksti o'rnatilmagan ulanish ochib, RLS siyosatini buzardi).
  async receiveLot(params: {
    tenantId: string;
    propertyId?: string;
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

    const totalCost = (Number(params.quantity) * Number(params.unitCost)).toFixed(2);

    const transaction = await transactionRepo.save(
      transactionRepo.create({
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        stockItemId: params.stockItemId,
        type: params.transactionType ?? StockTransactionType.RECEIPT,
        quantity: params.quantity,
        unitCost: params.unitCost,
        totalCost,
        referenceType:
          params.referenceType ?? (params.purchaseOrderId ? 'purchase_order' : 'manual_receipt'),
        referenceId: params.purchaseOrderId ?? null,
        notes: params.notes ?? null,
        createdByUserId: params.createdByUserId ?? null,
      }),
    );

    // Faqat haqiqiy xarid buyurtmasi orqali (real tannarx bilan) qabul qilinganda
    // moliyaviy provodka yoziladi: Ombor zaxirasi (aktiv) ortadi, Kreditorlik qarz
    // (ta'minotchiga) ortadi. Qo'lda/tuzatish kirimlari (odatda narxi 0) uchun
    // moliyaviy ta'sir yo'q — postSimpleEntry 0 miqdorni o'zi o'tkazib yuboradi.
    if (params.propertyId && params.purchaseOrderId) {
      await this.accountingService.postSimpleEntry({
        tenantId: params.tenantId,
        propertyId: params.propertyId,
        description: `Ombor kirimi (xarid buyurtmasi) — ${params.purchaseOrderId.slice(0, 8)}`,
        sourceModule: 'warehouse',
        sourceId: savedLot.id,
        debitSystemKey: 'inventory',
        creditSystemKey: 'accounts_payable',
        amount: totalCost,
        manager: params.manager,
      });
    }

    return { lot: savedLot, transaction };
  }

  // FIFO chiqim: eng eski partiyalardan boshlab so'raldigan miqdorni yechadi.
  // Yetarli zaxira bo'lmasa butun operatsiya bekor qilinadi (xato tashlanadi —
  // butun so'rov tranzaksiyasi RlsTransactionInterceptor orqali rollback bo'ladi).
  //
  // `postingKind`: 'consumption' — oddiy iste'mol (F&B tannarxi yoki umumiy xarajat
  // hisobiga); 'variance' — inventarizatsiya kamomadi (Ombor tanqisligi xarajati
  // hisobiga). `adjust()` manfiy tuzatish uchun 'variance'ni beradi.
  async issue(
    tenantId: string,
    warehouseId: string,
    dto: IssueStockDto,
    userId?: string | null,
    options?: { propertyId?: string; postingKind?: 'consumption' | 'variance' },
  ): Promise<StockTransaction> {
    const requestedQty = Number(dto.quantity);
    if (!(requestedQty > 0)) {
      throw new BadRequestException("Chiqim miqdori musbat bo'lishi kerak");
    }

    const stockItem = await this.stockItemRepo.findOneBy({ id: dto.stockItemId, tenantId });
    if (!stockItem) {
      throw new NotFoundException('Tovar topilmadi');
    }

    const lots = await this.lotRepo
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

    await this.lotRepo.save(updatedLots);

    const avgUnitCost = totalCost / requestedQty;

    const transaction = await this.transactionRepo.save(
      this.transactionRepo.create({
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

    if (options?.propertyId) {
      const postingKind = options.postingKind ?? 'consumption';
      const debitSystemKey =
        postingKind === 'variance' ? 'inventory_variance' : classifyExpenseSystemKey(stockItem.category);
      await this.accountingService.postSimpleEntry({
        tenantId,
        propertyId: options.propertyId,
        description:
          postingKind === 'variance'
            ? `Inventarizatsiya kamomadi — ${stockItem.name}`
            : `Ombor chiqimi — ${stockItem.name}`,
        sourceModule: 'warehouse',
        sourceId: transaction.id,
        debitSystemKey,
        creditSystemKey: 'inventory',
        amount: totalCost,
      });
    }

    return transaction;
  }

  // Inventarizatsiya tuzatishi: musbat (ortiqcha topildi, yangi lot sifatida qo'shiladi,
  // narxi 0 — moliyaviy ta'sirsiz hisoblanadi hozircha) yoki manfiy (yo'qotish, FIFO
  // bo'yicha yechiladi, "Ombor tanqisligi" xarajati sifatida provodka qilinadi).
  async adjust(
    tenantId: string,
    warehouseId: string,
    dto: AdjustStockDto,
    userId?: string | null,
    propertyId?: string,
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

    // Manfiy tuzatish — FIFO bo'yicha yechish (issue bilan bir xil mexanizm),
    // lekin "iste'mol" emas, "tanqislik" sifatida provodka qilinadi.
    const issued = await this.issue(
      tenantId,
      warehouseId,
      { stockItemId: dto.stockItemId, quantity: Math.abs(qty).toFixed(3), notes: dto.reason },
      userId,
      { propertyId, postingKind: 'variance' },
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
