import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { SubscriptionInvoice, SubscriptionInvoiceStatus } from './entities/subscription-invoice.entity';
import { PLAN_PRICING, listPlanPricing } from './constants/plan-pricing';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// SaaS platformasi <-> tenant (mehmonxona) obuna to'lovlarini boshqaradi.
// Hozircha haqiqiy to'lov shlyuzi ulanmagan — hisob-fakturalar platforma
// admin tomonidan qo'lda yaratiladi va "to'landi" deb belgilanadi (mock
// oqim). Bu jadval ATAYLAB RLS'siz — sabab: entity fayldagi izohga qarang.
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(SubscriptionInvoice) private readonly invoiceRepo: Repository<SubscriptionInvoice>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  getPlans() {
    return listPlanPricing();
  }

  private withComputedFields(invoice: SubscriptionInvoice) {
    const isOverdue = invoice.status === SubscriptionInvoiceStatus.PENDING && invoice.dueDate < isoToday();
    return { ...invoice, isOverdue };
  }

  async getMySubscription(tenantId: string) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const latestInvoice = await this.invoiceRepo.findOne({
      where: { tenantId },
      order: { issuedAt: 'DESC' },
    });
    return {
      plan: tenant.plan,
      status: tenant.status,
      pricing: PLAN_PRICING[tenant.plan],
      latestInvoice: latestInvoice ? this.withComputedFields(latestInvoice) : null,
    };
  }

  async listInvoicesForTenant(tenantId: string) {
    const invoices = await this.invoiceRepo.find({ where: { tenantId }, order: { issuedAt: 'DESC' } });
    return invoices.map((inv) => this.withComputedFields(inv));
  }

  async listAllInvoices(filters: { tenantId?: string; status?: SubscriptionInvoiceStatus }) {
    const where: FindOptionsWhere<SubscriptionInvoice> = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.status) where.status = filters.status;

    const invoices = await this.invoiceRepo.find({ where, order: { issuedAt: 'DESC' } });
    const tenantIds = [...new Set(invoices.map((inv) => inv.tenantId))];
    const tenants = tenantIds.length ? await this.tenantRepo.findBy({ id: In(tenantIds) }) : [];
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    return invoices.map((inv) => ({
      ...this.withComputedFields(inv),
      tenantName: tenantById.get(inv.tenantId)?.name ?? null,
    }));
  }

  async generateInvoice(tenantId: string, dto: GenerateInvoiceDto): Promise<SubscriptionInvoice> {
    const tenant = await this.findTenantOrThrow(tenantId);
    if (dto.periodEnd < dto.periodStart) {
      throw new BadRequestException("Davr tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
    }

    const pricing = PLAN_PRICING[tenant.plan];
    const invoice = this.invoiceRepo.create({
      tenantId,
      plan: tenant.plan,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      amount: pricing.monthlyPrice.toFixed(2),
      currency: pricing.currency,
      status: SubscriptionInvoiceStatus.PENDING,
      dueDate: dto.dueDate ?? dto.periodEnd,
      issuedAt: new Date(),
      notes: dto.notes ?? null,
    });
    return this.invoiceRepo.save(invoice);
  }

  async markPaid(invoiceId: string, adminUserId: string): Promise<SubscriptionInvoice> {
    const invoice = await this.findInvoiceOrThrow(invoiceId);
    if (invoice.status === SubscriptionInvoiceStatus.CANCELLED) {
      throw new BadRequestException("Bekor qilingan hisob-fakturani to'langan deb belgilab bo'lmaydi");
    }

    invoice.status = SubscriptionInvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.markedPaidByUserId = adminUserId;
    const saved = await this.invoiceRepo.save(invoice);

    // To'lov tasdiqlanganda muzlatilgan (suspended) yoki sinov (trial) tenant'ni
    // avtomatik faollashtiramiz — qo'lda qo'shimcha qadam shart emas.
    const tenant = await this.tenantRepo.findOneBy({ id: invoice.tenantId });
    if (tenant && (tenant.status === TenantStatus.SUSPENDED || tenant.status === TenantStatus.TRIAL)) {
      tenant.status = TenantStatus.ACTIVE;
      await this.tenantRepo.save(tenant);
    }

    return saved;
  }

  async cancelInvoice(invoiceId: string): Promise<SubscriptionInvoice> {
    const invoice = await this.findInvoiceOrThrow(invoiceId);
    if (invoice.status === SubscriptionInvoiceStatus.PAID) {
      throw new BadRequestException("To'langan hisob-fakturani bekor qilib bo'lmaydi");
    }
    invoice.status = SubscriptionInvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  private async findTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');
    return tenant;
  }

  private async findInvoiceOrThrow(id: string): Promise<SubscriptionInvoice> {
    const invoice = await this.invoiceRepo.findOneBy({ id });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }
}
