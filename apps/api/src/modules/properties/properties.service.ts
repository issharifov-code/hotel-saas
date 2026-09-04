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

  // Logotipni o'rnatish/almashtirish. `logoUrl` DTO darajasida allaqachon
  // tekshirilgan (faqat rasm MIME'lari, hajm chegarasi) — bu yerda faqat
  // mulkning shu tenant'ga tegishliligi tasdiqlanadi (findById orqali).
  async setLogo(
    tenantId: string,
    propertyId: string,
    logoUrl: string,
  ): Promise<Property> {
    const property = await this.findById(tenantId, propertyId);
    property.logoUrl = logoUrl;
    return this.propertyRepo.save(property);
  }

  // Logotipni olib tashlash — frontend yana nomining bosh harfi bilan
  // piktogrammaga qaytadi (AppLayout `propertyInitial()`).
  async removeLogo(tenantId: string, propertyId: string): Promise<Property> {
    const property = await this.findById(tenantId, propertyId);
    property.logoUrl = null;
    return this.propertyRepo.save(property);
  }
}
