import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';

@Injectable()
export class MenuItemsService {
  constructor(@InjectRepository(MenuItem) private readonly menuItemRepo: Repository<MenuItem>) {}

  async create(tenantId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    const item = this.menuItemRepo.create({
      tenantId,
      name: dto.name,
      category: dto.category ?? null,
      price: dto.price,
      isActive: dto.isActive ?? true,
    });
    return this.menuItemRepo.save(item);
  }

  async list(tenantId: string, activeOnly = false): Promise<MenuItem[]> {
    return this.menuItemRepo.find({
      where: activeOnly ? { tenantId, isActive: true } : { tenantId },
      order: { name: 'ASC' },
    });
  }

  async findById(tenantId: string, id: string): Promise<MenuItem> {
    const item = await this.menuItemRepo.findOneBy({ id, tenantId });
    if (!item) throw new NotFoundException('Menyu taomi topilmadi');
    return item;
  }
}
