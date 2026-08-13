import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PosOutlet } from './entities/pos-outlet.entity';

@Injectable()
export class PosOutletsService {
  constructor(@InjectRepository(PosOutlet) private readonly outletRepo: Repository<PosOutlet>) {}

  async getOrCreateDefault(tenantId: string, propertyId: string): Promise<PosOutlet> {
    const existing = await this.outletRepo.findOne({ where: { tenantId, propertyId, isDefault: true } });
    if (existing) return existing;

    return this.outletRepo.save(
      this.outletRepo.create({
        tenantId,
        propertyId,
        name: 'Asosiy savdo nuqtasi',
        isDefault: true,
      }),
    );
  }

  async listByProperty(tenantId: string, propertyId: string): Promise<PosOutlet[]> {
    await this.getOrCreateDefault(tenantId, propertyId);
    return this.outletRepo.find({ where: { tenantId, propertyId }, order: { createdAt: 'ASC' } });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<PosOutlet> {
    const outlet = await this.outletRepo.findOneBy({ id, tenantId, propertyId });
    if (!outlet) throw new NotFoundException('Savdo nuqtasi topilmadi');
    return outlet;
  }
}
