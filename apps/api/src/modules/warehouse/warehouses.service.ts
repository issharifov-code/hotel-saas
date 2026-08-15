import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';

@Injectable()
export class WarehousesService {
  constructor(@InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>) {}

  // MVP: property boshiga bitta "Asosiy ombor" — birinchi murojaatda avtomatik yaratiladi (lazy).
  async getOrCreateDefault(tenantId: string, propertyId: string): Promise<Warehouse> {
    const existing = await this.warehouseRepo.findOne({
      where: { tenantId, propertyId, isDefault: true },
    });
    if (existing) return existing;

    return this.warehouseRepo.save(
      this.warehouseRepo.create({
        tenantId,
        propertyId,
        name: 'Asosiy ombor',
        isDefault: true,
      }),
    );
  }

  async listByProperty(tenantId: string, propertyId: string): Promise<Warehouse[]> {
    await this.getOrCreateDefault(tenantId, propertyId);
    return this.warehouseRepo.find({ where: { tenantId, propertyId }, order: { createdAt: 'ASC' } });
  }

  // Qo'shimcha ombor nuqtasi qo'lda yaratish uchun (masalan oshxona ombori, bar ombori
  // — asosiy "Asosiy ombor"dan tashqari). Har doim isDefault=false bilan yaratiladi,
  // birinchi (default) ombor faqat getOrCreateDefault orqali beriladi.
  async create(tenantId: string, propertyId: string, name: string): Promise<Warehouse> {
    return this.warehouseRepo.save(
      this.warehouseRepo.create({
        tenantId,
        propertyId,
        name,
        isDefault: false,
      }),
    );
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOneBy({ id, tenantId, propertyId });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');
    return warehouse;
  }
}
