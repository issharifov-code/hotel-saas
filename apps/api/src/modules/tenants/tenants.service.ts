import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantPlan, TenantStatus } from './entities/tenant.entity';
import { Property } from '../properties/entities/property.entity';
import { AccountingService } from '../accounting/accounting.service';

const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Property) private readonly propertyRepo: Repository<Property>,
    private readonly accountingService: AccountingService,
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

    // `properties` jadvali RLS bilan himoyalangan (operatsion jadval), lekin
    // ro'yxatdan o'tish oqimi hali AUTENTIFIKATSIYA QILINMAGAN holatda ishga
    // tushadi (bootstrap muammosi — hali `request.user`/tenant konteksti
    // yo'q). Shu sabab tenant va uning standart property'sini BITTA aniq
    // tranzaksiyada yaratamiz va property yozilishidan oldin sessiya
    // kontekstini QO'LDA o'rnatamiz — bu xavfsiz, chunki tenant ID shu
    // yerning o'zida, shu tranzaksiya ichida endigina yaratilgan qiymat.
    return this.tenantRepo.manager.transaction(async (manager) => {
      const tenant = await manager.save(
        manager.create(Tenant, {
          name: params.tenantName.trim(),
          subdomain,
          baseCurrency: params.baseCurrency || 'UZS',
          status: TenantStatus.TRIAL,
          plan: TenantPlan.START,
        }),
      );

      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenant.id]);

      // Standart (soddalashtirilgan USALI) hisoblar rejasi — buxgalteriya moduli
      // ishlashi uchun har bir tenant kamida shu hisoblarga ega bo'lishi shart
      // (avtomatik provodka `systemKey` orqali ularni topadi).
      await this.accountingService.seedDefaultChartOfAccounts(tenant.id, manager);

      const property = await manager.save(
        manager.create(Property, {
          tenantId: tenant.id,
          name: params.propertyName || params.tenantName,
          currency: tenant.baseCurrency,
        }),
      );

      return { tenant, property };
    });
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
