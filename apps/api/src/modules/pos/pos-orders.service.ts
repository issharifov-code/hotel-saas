import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  PosOrder,
  PosOrderStatus,
  PosPaymentMethod,
} from './entities/pos-order.entity';
import { PosOrderItem } from './entities/pos-order-item.entity';
import { MenuItem } from './entities/menu-item.entity';
import {
  CreatePosOrderDto,
  CreatePosOrderItemDto,
} from './dto/create-pos-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { InvoicingService } from '../invoicing/invoicing.service';
import { AccountingService } from '../accounting/accounting.service';

// PosPaymentMethod (naqd/karta, to'g'ridan-to'g'ri to'lov) -> Accounting hisob
// system key. ROOM_ACCOUNT bu yerda yo'q — u InvoicingService.chargeToFolioByBooking
// orqali allaqachon provodka qilinadi (Debitorlik/F&B daromadi).
const DIRECT_PAYMENT_SYSTEM_KEY: Partial<Record<PosPaymentMethod, string>> = {
  [PosPaymentMethod.CASH]: 'cash',
  [PosPaymentMethod.CARD]: 'card_clearing',
};

@Injectable()
export class PosOrdersService {
  constructor(
    @InjectRepository(PosOrder)
    private readonly orderRepo: Repository<PosOrder>,
    @InjectRepository(PosOrderItem)
    private readonly orderItemRepo: Repository<PosOrderItem>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    private readonly invoicingService: InvoicingService,
    private readonly accountingService: AccountingService,
  ) {}

  async create(
    tenantId: string,
    propertyId: string,
    outletId: string,
    userId: string,
    dto: CreatePosOrderDto,
  ): Promise<PosOrder> {
    const items = await this.buildOrderItems(tenantId, dto.items);
    const totalAmount = this.sumItems(items);

    const order = this.orderRepo.create({
      tenantId,
      propertyId,
      outletId,
      status: PosOrderStatus.OPEN,
      tableNumber: dto.tableNumber ?? null,
      guestId: dto.guestId ?? null,
      totalAmount,
      currency: 'UZS',
      createdByUserId: userId,
      notes: dto.notes ?? null,
      items,
    });

    return this.orderRepo.save(order);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    status?: PosOrderStatus,
  ): Promise<PosOrder[]> {
    return this.orderRepo.find({
      where: status
        ? { tenantId, propertyId, status }
        : { tenantId, propertyId },
      relations: { items: { menuItem: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<PosOrder> {
    const order = await this.orderRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { items: { menuItem: true } },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    return order;
  }

  async addItems(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: AddOrderItemsDto,
  ): Promise<PosOrder> {
    const order = await this.findById(tenantId, propertyId, id);
    if (order.status !== PosOrderStatus.OPEN) {
      throw new ConflictException(
        `Faqat "open" holatidagi buyurtmaga taom qo'shish mumkin (joriy holat: ${order.status})`,
      );
    }

    const newItems = await this.buildOrderItems(tenantId, dto.items, id);
    await this.orderItemRepo.save(newItems);

    const refreshed = await this.findById(tenantId, propertyId, id);
    refreshed.totalAmount = this.sumItems(refreshed.items);
    return this.orderRepo.save(refreshed);
  }

  async pay(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: PayOrderDto,
  ): Promise<PosOrder> {
    const order = await this.findById(tenantId, propertyId, id);
    if (order.status !== PosOrderStatus.OPEN) {
      throw new ConflictException(
        `Faqat "open" holatidagi buyurtmani to'lash mumkin (joriy holat: ${order.status})`,
      );
    }
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException("Bo'sh buyurtmani to'lab bo'lmaydi");
    }

    if (dto.paymentMethod === PosPaymentMethod.ROOM_ACCOUNT) {
      if (!dto.bookingId) {
        throw new BadRequestException(
          'Xona hisobiga yozish uchun bron tanlanishi shart',
        );
      }
      await this.invoicingService.chargeToFolioByBooking(
        tenantId,
        propertyId,
        dto.bookingId,
        `POS buyurtma (${order.tableNumber ? `stol ${order.tableNumber}` : order.id.slice(0, 8)})`,
        order.totalAmount,
        order.id,
      );
      order.bookingId = dto.bookingId;
    } else {
      const debitSystemKey = DIRECT_PAYMENT_SYSTEM_KEY[dto.paymentMethod];
      if (debitSystemKey) {
        await this.accountingService.postSimpleEntry({
          tenantId,
          propertyId,
          description: `POS to'lovi (${order.tableNumber ? `stol ${order.tableNumber}` : order.id.slice(0, 8)})`,
          sourceModule: 'pos',
          sourceId: order.id,
          debitSystemKey,
          creditSystemKey: 'fb_revenue',
          amount: order.totalAmount,
        });
      }
    }

    order.status = PosOrderStatus.PAID;
    order.paymentMethod = dto.paymentMethod;
    order.paidAt = new Date();
    return this.orderRepo.save(order);
  }

  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<PosOrder> {
    const order = await this.findById(tenantId, propertyId, id);
    if (order.status !== PosOrderStatus.OPEN) {
      throw new ConflictException(
        `Faqat "open" holatidagi buyurtmani bekor qilish mumkin (joriy holat: ${order.status})`,
      );
    }
    order.status = PosOrderStatus.CANCELLED;
    return this.orderRepo.save(order);
  }

  private async buildOrderItems(
    tenantId: string,
    lines: CreatePosOrderItemDto[],
    orderId?: string,
  ): Promise<PosOrderItem[]> {
    // N+1 tuzatish (2026-09-02, polish audit): avval har bir qator uchun
    // alohida `findOneBy` so'rovi yuborilardi (N ta buyurtma bandi = N ta
    // so'rov, POS'da har bir buyurtmada chaqiriladigan "hot path"). Endi
    // barcha menyu taomi ID'lari bitta `IN (...)` so'roviga yig'iladi.
    const menuItemIds = [...new Set(lines.map((line) => line.menuItemId))];
    const menuItems = await this.menuItemRepo.find({
      where: { id: In(menuItemIds), tenantId },
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

    const items: PosOrderItem[] = [];
    for (const line of lines) {
      const menuItem = menuItemById.get(line.menuItemId);
      if (!menuItem)
        throw new NotFoundException(
          `Menyu taomi topilmadi: ${line.menuItemId}`,
        );
      if (!menuItem.isActive) {
        throw new BadRequestException(
          `"${menuItem.name}" hozircha sotuvda emas (faol emas)`,
        );
      }
      items.push(
        this.orderItemRepo.create({
          orderId,
          menuItemId: menuItem.id,
          quantity: line.quantity,
          unitPrice: menuItem.price,
          notes: line.notes ?? null,
        }),
      );
    }
    return items;
  }

  private sumItems(items: PosOrderItem[]): string {
    return items
      .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
      .toFixed(2);
  }
}
