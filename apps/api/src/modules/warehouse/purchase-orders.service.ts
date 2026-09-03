import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { StockItem } from './entities/stock-item.entity';
import { Supplier } from './entities/supplier.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { StockService } from './stock.service';

const OPEN_STATUSES = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.PENDING_APPROVAL,
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
];

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(StockItem)
    private readonly stockItemRepo: Repository<StockItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly stockService: StockService,
  ) {}

  async create(
    tenantId: string,
    propertyId: string,
    warehouseId: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const supplier = await this.supplierRepo.findOneBy({
      id: dto.supplierId,
      tenantId,
    });
    if (!supplier) throw new NotFoundException("Ta'minotchi topilmadi");

    // N+1 tuzatish (2026-09-02, polish audit): avval har bir band uchun
    // alohida `findOneBy` so'rovi yuborilardi. Endi barcha tovar ID'lari
    // bitta `IN (...)` so'roviga yig'iladi.
    const stockItemIds = [
      ...new Set(dto.items.map((line) => line.stockItemId)),
    ];
    const foundStockItems = await this.stockItemRepo.find({
      where: { id: In(stockItemIds), tenantId },
    });
    const foundIds = new Set(foundStockItems.map((item) => item.id));
    for (const line of dto.items) {
      if (!foundIds.has(line.stockItemId)) {
        throw new NotFoundException(`Tovar topilmadi: ${line.stockItemId}`);
      }
    }

    const totalAmount = dto.items
      .reduce(
        (sum, line) =>
          sum + Number(line.quantityOrdered) * Number(line.unitCost),
        0,
      )
      .toFixed(2);

    const po = this.poRepo.create({
      tenantId,
      propertyId,
      warehouseId,
      supplierId: dto.supplierId,
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      totalAmount,
      currency: dto.currency ?? 'UZS',
      createdByUserId: userId,
      notes: dto.notes ?? null,
      items: dto.items.map((line) =>
        this.poItemRepo.create({
          stockItemId: line.stockItemId,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
        }),
      ),
    });

    return this.poRepo.save(po);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    status?: PurchaseOrderStatus,
  ): Promise<PurchaseOrder[]> {
    return this.poRepo.find({
      where: status
        ? { tenantId, propertyId, status }
        : { tenantId, propertyId },
      relations: { items: { stockItem: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { items: { stockItem: true } },
    });
    if (!po) throw new NotFoundException('Xarid buyurtmasi topilmadi');
    return po;
  }

  async approve(
    tenantId: string,
    propertyId: string,
    id: string,
    approverUserId: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findById(tenantId, propertyId, id);
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Faqat "pending_approval" holatidagi buyurtmani tasdiqlash mumkin (joriy holat: ${po.status})`,
      );
    }
    po.status = PurchaseOrderStatus.APPROVED;
    po.approvedByUserId = approverUserId;
    po.approvedAt = new Date();
    return this.poRepo.save(po);
  }

  async reject(
    tenantId: string,
    propertyId: string,
    id: string,
    approverUserId: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findById(tenantId, propertyId, id);
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Faqat "pending_approval" holatidagi buyurtmani rad etish mumkin (joriy holat: ${po.status})`,
      );
    }
    po.status = PurchaseOrderStatus.REJECTED;
    po.approvedByUserId = approverUserId;
    po.approvedAt = new Date();
    return this.poRepo.save(po);
  }

  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findById(tenantId, propertyId, id);
    if (!OPEN_STATUSES.includes(po.status)) {
      throw new ConflictException(
        `"${po.status}" holatidagi buyurtmani bekor qilib bo'lmaydi`,
      );
    }
    po.status = PurchaseOrderStatus.CANCELLED;
    return this.poRepo.save(po);
  }

  // Qisman yoki to'liq qabul qilish — har bir band uchun kiritilgan miqdorda yangi
  // StockLot yaratiladi (FIFO uchun) va PO holati avtomatik yangilanadi.
  async receive(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findById(tenantId, propertyId, id);
    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new ConflictException(
        `Faqat "approved" yoki "partially_received" holatidagi buyurtmani qabul qilish mumkin (joriy holat: ${po.status})`,
      );
    }

    const itemsById = new Map(po.items.map((item) => [item.id, item]));

    for (const line of dto.lines) {
      const item = itemsById.get(line.purchaseOrderItemId);
      if (!item) {
        throw new BadRequestException(
          `Buyurtma bandi topilmadi: ${line.purchaseOrderItemId}`,
        );
      }
      const alreadyReceived = Number(item.quantityReceived);
      const ordered = Number(item.quantityOrdered);
      const receivingNow = Number(line.quantityReceived);
      if (receivingNow <= 0) {
        throw new BadRequestException(
          "Qabul qilinayotgan miqdor musbat bo'lishi kerak",
        );
      }
      if (alreadyReceived + receivingNow > ordered + 1e-9) {
        throw new BadRequestException(
          `Buyurtma qilingan miqdordan ortiq qabul qilib bo'lmaydi (${item.stockItemId}: buyurtma=${ordered}, allaqachon=${alreadyReceived}, urinilgan=${receivingNow})`,
        );
      }
    }

    // Izoh: bu yerda avval alohida `dataSource.transaction()` ochilar edi — bu xato edi,
    // chunki u so'rovning RLS-skopli tranzaksiyasidan (RlsContextService orqali ochilgan,
    // `app.tenant_id` o'rnatilgan) mustaqil, yangi ulanish ochadi va shu ulanishda tenant
    // konteksti o'rnatilmagani uchun RLS siyosati yozishlarni bloklaydi. To'g'ri yechim —
    // shu servisning REQUEST-scoped repository'laridan (`poItemRepo`, `poRepo`) va
    // `stockService.receiveLot()`ning `manager` argumentisiz (ya'ni o'zining REQUEST-scoped
    // repolaridan) foydalanishidan foydalanish — bularning barchasi allaqachon BITTA so'rov
    // tranzaksiyasi ichida ishlaydi.
    for (const line of dto.lines) {
      const item = itemsById.get(line.purchaseOrderItemId)!;
      await this.stockService.receiveLot({
        tenantId,
        propertyId,
        warehouseId: po.warehouseId,
        stockItemId: item.stockItemId,
        quantity: line.quantityReceived,
        unitCost: item.unitCost,
        purchaseOrderId: po.id,
        createdByUserId: userId,
      });
      item.quantityReceived = (
        Number(item.quantityReceived) + Number(line.quantityReceived)
      ).toFixed(3);
      await this.poItemRepo.save(item);
    }

    const refreshedItems = await this.poItemRepo.find({
      where: { purchaseOrderId: po.id },
    });
    const fullyReceived = refreshedItems.every(
      (item) =>
        Number(item.quantityReceived) >= Number(item.quantityOrdered) - 1e-9,
    );
    po.status = fullyReceived
      ? PurchaseOrderStatus.RECEIVED
      : PurchaseOrderStatus.PARTIALLY_RECEIVED;
    return this.poRepo.save(po);
  }
}
