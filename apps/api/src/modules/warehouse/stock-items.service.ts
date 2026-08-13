import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockItem } from './entities/stock-item.entity';
import { CreateStockItemDto } from './dto/create-stock-item.dto';

@Injectable()
export class StockItemsService {
  constructor(@InjectRepository(StockItem) private readonly stockItemRepo: Repository<StockItem>) {}

  async create(tenantId: string, dto: CreateStockItemDto): Promise<StockItem> {
    const existing = await this.stockItemRepo.findOneBy({ tenantId, sku: dto.sku });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" allaqachon mavjud`);
    }
    const item = this.stockItemRepo.create({
      tenantId,
      sku: dto.sku,
      name: dto.name,
      unit: dto.unit,
      category: dto.category ?? null,
      reorderPoint: dto.reorderPoint ?? '0',
      isActive: dto.isActive ?? true,
    });
    return this.stockItemRepo.save(item);
  }

  async list(tenantId: string, activeOnly = false): Promise<StockItem[]> {
    return this.stockItemRepo.find({
      where: activeOnly ? { tenantId, isActive: true } : { tenantId },
      order: { name: 'ASC' },
    });
  }

  async findById(tenantId: string, id: string): Promise<StockItem> {
    const item = await this.stockItemRepo.findOneBy({ id, tenantId });
    if (!item) throw new NotFoundException('Tovar topilmadi');
    return item;
  }
}
