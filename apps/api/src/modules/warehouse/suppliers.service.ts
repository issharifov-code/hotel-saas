import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(@InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>) {}

  async create(tenantId: string, dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepo.create({
      tenantId,
      name: dto.name,
      contactPerson: dto.contactPerson ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
    });
    return this.supplierRepo.save(supplier);
  }

  async list(tenantId: string): Promise<Supplier[]> {
    return this.supplierRepo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async findById(tenantId: string, id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOneBy({ id, tenantId });
    if (!supplier) throw new NotFoundException("Ta'minotchi topilmadi");
    return supplier;
  }
}
