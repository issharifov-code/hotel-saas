import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';

@Injectable()
export class PropertiesService {
  constructor(@InjectRepository(Property) private readonly propertyRepo: Repository<Property>) {}

  async listByTenant(tenantId: string): Promise<Property[]> {
    return this.propertyRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async findById(tenantId: string, id: string): Promise<Property> {
    const property = await this.propertyRepo.findOneBy({ id, tenantId });
    if (!property) throw new NotFoundException('Mulk (property) topilmadi');
    return property;
  }
}
