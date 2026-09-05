import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
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
// oqim).
//
// 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). `subscription_invoices` da
// `tenant_id` bor, lekin RLS umuman yoqilmagan edi — ya'ni bu tizimdagi
// YAGONA per-tenant moliyaviy jadval baza darajasida hech qanday
// izolyatsiyasiz turardi, `findInvoiceOrThrow` esa tenant filtrisiz
// `findOneBy({ id })` qiladi. Migratsiya 1789600000000 RLS'ni yoqdi.
//
// Bu servis `UsersService` naqshini takrorlaydi: ambient so'rov
// kontekstiga tayanmaydi (moduli `TypeOrmModule.forFeature` da qoladi),
// balki HAR BIR metodda o'z tranzaksiyasini ochib, ichida `set_config`
// qiladi:
//   `withTenant`  — tenant o'z ma'lumotini ko'radi (himoyalangan yo'l);
//   `withBypass`  — platforma admini barcha tenantlarni ko'rishi kerak
//                   bo'lgan sanoqli joylar (aniq nomlangan bayroq).
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(SubscriptionInvoice) private readonly invoiceRepo: Repository<SubscriptionInvoice>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private async withTenant<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.invoiceRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.tenant_id',
        tenantId,
      ]);
      return fn(manager);
    });
  }

  // Platforma admini (tenantId null) barcha tenantlarning obuna
  // hisob-fakturalarini ko'rishi va boshqarishi kerak — bu uning yagona
  // vazifasi. Chetlab o'tish ANIQ nomlangan (`app.billing_bypass`) va
  // faqat shu tranzaksiya ichida amal qiladi.
  private async withBypass<T>(
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.invoiceRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.billing_bypass',
        'on',
      ]);
      return fn(manager);
    });
  }

  getPlans() {
    return listPlanPricing();
  }

  private withComputedFields(invoice: SubscriptionInvoice) {
    const isOverdue = invoice.status === SubscriptionInvoiceStatus.PENDING && invoice.dueDate < isoToday();
    return { ...invoice, isOverdue };
  }

  async getMySubscription(tenantId: string) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const latestInvoice = await this.withTenant(tenantId, (m) =>
      m.getRepository(SubscriptionInvoice).findOne({
        where: { tenantId },
        order: { issuedAt: 'DESC' },
      }),
    );
    return {
      plan: tenant.plan,
      status: tenant.status,
      pricing: PLAN_PRICING[tenant.plan],
      latestInvoice: latestInvoice ? this.withComputedFields(latestInvoice) : null,
    };
  }

  async listInvoicesForTenant(tenantId: string) {
    const invoices = await this.withTenant(tenantId, (m) =>
      m
        .getRepository(SubscriptionInvoice)
        .find({ where: { tenantId }, order: { issuedAt: 'DESC' } }),
    );
    return invoices.map((inv) => this.withComputedFields(inv));
  }

  async listAllInvoices(filters: { tenantId?: string; status?: SubscriptionInvoiceStatus }) {
    const where: FindOptionsWhere<SubscriptionInvoice> = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.status) where.status = filters.status;

    const invoices = await this.withBypass((m) =>
      m.getRepository(SubscriptionInvoice).find({ where, order: { issuedAt: 'DESC' } }),
    );
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
    return this.withBypass((m) =>
      m.getRepository(SubscriptionInvoice).save(invoice),
    );
  }

  async markPaid(invoiceId: string, adminUserId: string): Promise<SubscriptionInvoice> {
    const invoice = await this.findInvoiceOrThrow(invoiceId);
    if (invoice.status === SubscriptionInvoiceStatus.CANCELLED) {
      throw new BadRequestException("Bekor qilingan hisob-fakturani to'langan deb belgilab bo'lmaydi");
    }

    invoice.status = SubscriptionInvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.markedPaidByUserId = adminUserId;
    const saved = await this.withBypass((m) =>
      m.getRepository(SubscriptionInvoice).save(invoice),
    );

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
    return this.withBypass((m) =>
      m.getRepository(SubscriptionInvoice).save(invoice),
    );
  }

  private async findTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');
    return tenant;
  }

  // ATAYLAB bypass bilan: bu metod faqat platforma admin yo'llaridan
  // chaqiriladi (`PlatformAdminGuard`), unda tenant konteksti yo'q.
  private async findInvoiceOrThrow(id: string): Promise<SubscriptionInvoice> {
    const invoice = await this.withBypass((m) =>
      m.getRepository(SubscriptionInvoice).findOneBy({ id }),
    );
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }
}
