import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantPlan, TenantStatus } from './entities/tenant.entity';
import { Property } from '../properties/entities/property.entity';

const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Property) private readonly propertyRepo: Repository<Property>,
  ) {}

  async createTenantWithDefaultProperty(params: {
    tenantName: string;
    subdomain: string;
    baseCurrency?: string;
    propertyName?: string;
  }): Promise<{ tenant: Tenant; property: Property }> {
    const subdomain = params.subdomain.trim().toLowerCase();
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      throw new ConflictException(
        'Subdomain faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo\'lishi kerak',
      );
    }

    const existing = await this.tenantRepo.findOneBy({ subdomain });
    if (existing) {
      throw new ConflictException('Bu subdomain allaqachon band');
    }

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        name: params.tenantName.trim(),
        subdomain,
        baseCurrency: params.baseCurrency || 'UZS',
        status: TenantStatus.TRIAL,
        plan: TenantPlan.START,
      }),
    );

    const property = await this.propertyRepo.save(
      this.propertyRepo.create({
        tenantId: tenant.id,
        name: params.propertyName || params.tenantName,
        currency: tenant.baseCurrency,
      }),
    );

    return { tenant, property };
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');
    return tenant;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ subdomain: subdomain.toLowerCase() });
  }

  async listAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.status = status;
    return this.tenantRepo.save(tenant);
  }
}
