import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { SubscriptionInvoiceStatus } from './entities/subscription-invoice.entity';
import { TenantPlan, TenantStatus } from '../tenants/entities/tenant.entity';

// Bu testlar BillingService'ning eng nozik qismlarini tekshiradi: reja
// narxidan hisob-faktura summasini avtomatik hisoblash, to'lov tasdiqlanganda
// muzlatilgan/sinov tenant'ni avtomatik faollashtirish, va allaqachon
// bekor qilingan/to'langan hisob-fakturalar ustida noto'g'ri amallarga
// yo'l qo'ymaslik — haqiqiy DB o'rniga minimal repo mock'lari kifoya.
describe('BillingService', () => {
  function createService(opts: {
    tenant?: { id: string; plan: TenantPlan; status: TenantStatus };
    invoice?: Record<string, unknown> | null;
  }) {
    const savedInvoices: Record<string, unknown>[] = [];
    const savedTenants: Record<string, unknown>[] = [];

    const invoiceRepo = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn((data: Record<string, unknown>) => {
        savedInvoices.push(data);
        return Promise.resolve(data);
      }),
      findOneBy: jest.fn().mockResolvedValue(opts.invoice ?? null),
      findOne: jest.fn().mockResolvedValue(opts.invoice ?? null),
      find: jest.fn().mockResolvedValue(opts.invoice ? [opts.invoice] : []),
    };
    // 🔴 2026-09-05 auditi (High): `subscription_invoices` da RLS yoqildi,
    // shuning uchun servis har bir metodda o'z tranzaksiyasini ochib,
    // ichida `set_config` qiladi (`UsersService` naqshi). Mock'da
    // tranzaksiya shunchaki callback'ni o'sha repo bilan chaqiradi.
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue(invoiceRepo),
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    (invoiceRepo as Record<string, unknown>).manager = manager;
    const tenantRepo = {
      findOneBy: jest.fn().mockResolvedValue(opts.tenant ?? null),
      findBy: jest.fn().mockResolvedValue(opts.tenant ? [opts.tenant] : []),
      save: jest.fn((data: Record<string, unknown>) => {
        savedTenants.push(data);
        return Promise.resolve(data);
      }),
    };

    const service = new BillingService(invoiceRepo as never, tenantRepo as never);
    return { service, invoiceRepo, tenantRepo, savedInvoices, savedTenants };
  }

  it("generateInvoice tenant rejasidan narxni to'g'ri hisoblaydi", async () => {
    const { service, savedInvoices } = createService({
      tenant: { id: 't1', plan: TenantPlan.PROFESSIONAL, status: TenantStatus.ACTIVE },
    });

    const result = await service.generateInvoice('t1', {
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });

    expect(result.amount).toBe('1490000.00');
    expect(result.currency).toBe('UZS');
    expect(result.status).toBe(SubscriptionInvoiceStatus.PENDING);
    expect(result.dueDate).toBe('2026-09-30'); // dueDate berilmasa periodEnd ishlatiladi
    expect(savedInvoices).toHaveLength(1);
  });

  it("generateInvoice davr tugashi boshlanishidan oldin bo'lsa xato tashlaydi", async () => {
    const { service } = createService({
      tenant: { id: 't1', plan: TenantPlan.START, status: TenantStatus.ACTIVE },
    });

    await expect(
      service.generateInvoice('t1', { periodStart: '2026-09-30', periodEnd: '2026-09-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("generateInvoice mavjud bo'lmagan tenant uchun NotFoundException tashlaydi", async () => {
    const { service } = createService({ tenant: undefined });
    await expect(
      service.generateInvoice('missing', { periodStart: '2026-09-01', periodEnd: '2026-09-30' }),
    ).rejects.toThrow(NotFoundException);
  });

  it("markPaid muzlatilgan (suspended) tenant'ni avtomatik faollashtiradi", async () => {
    const { service, savedTenants } = createService({
      tenant: { id: 't1', plan: TenantPlan.START, status: TenantStatus.SUSPENDED },
      invoice: {
        id: 'inv-1',
        tenantId: 't1',
        status: SubscriptionInvoiceStatus.PENDING,
        dueDate: '2026-09-30',
      },
    });

    await service.markPaid('inv-1', 'admin-1');

    expect(savedTenants).toHaveLength(1);
    expect(savedTenants[0].status).toBe(TenantStatus.ACTIVE);
  });

  it("markPaid sinov (trial) tenant'ni ham faollashtiradi", async () => {
    const { service, savedTenants } = createService({
      tenant: { id: 't1', plan: TenantPlan.START, status: TenantStatus.TRIAL },
      invoice: {
        id: 'inv-1',
        tenantId: 't1',
        status: SubscriptionInvoiceStatus.PENDING,
        dueDate: '2026-09-30',
      },
    });

    await service.markPaid('inv-1', 'admin-1');
    expect(savedTenants[0].status).toBe(TenantStatus.ACTIVE);
  });

  it("markPaid allaqachon faol tenant'ni qayta saqlamaydi", async () => {
    const { service, savedTenants } = createService({
      tenant: { id: 't1', plan: TenantPlan.START, status: TenantStatus.ACTIVE },
      invoice: {
        id: 'inv-1',
        tenantId: 't1',
        status: SubscriptionInvoiceStatus.PENDING,
        dueDate: '2026-09-30',
      },
    });

    await service.markPaid('inv-1', 'admin-1');
    expect(savedTenants).toHaveLength(0);
  });

  it("markPaid bekor qilingan hisob-fakturada xato tashlaydi", async () => {
    const { service } = createService({
      tenant: { id: 't1', plan: TenantPlan.START, status: TenantStatus.ACTIVE },
      invoice: { id: 'inv-1', tenantId: 't1', status: SubscriptionInvoiceStatus.CANCELLED, dueDate: '2026-09-30' },
    });

    await expect(service.markPaid('inv-1', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it("cancelInvoice to'langan hisob-fakturada xato tashlaydi", async () => {
    const { service } = createService({
      invoice: { id: 'inv-1', tenantId: 't1', status: SubscriptionInvoiceStatus.PAID, dueDate: '2026-09-30' },
    });

    await expect(service.cancelInvoice('inv-1')).rejects.toThrow(BadRequestException);
  });

  it("listInvoicesForTenant muddati o'tgan to'lanmagan hisob-fakturani isOverdue=true deb belgilaydi", async () => {
    const { service } = createService({
      invoice: {
        id: 'inv-1',
        tenantId: 't1',
        status: SubscriptionInvoiceStatus.PENDING,
        dueDate: '2000-01-01', // uzoq o'tmishda — har doim muddati o'tgan
      },
    });

    const result = await service.listInvoicesForTenant('t1');
    expect(result[0].isOverdue).toBe(true);
  });

  it("listInvoicesForTenant to'langan hisob-fakturani muddati o'tgan bo'lsa ham isOverdue=false deb belgilaydi", async () => {
    const { service } = createService({
      invoice: {
        id: 'inv-1',
        tenantId: 't1',
        status: SubscriptionInvoiceStatus.PAID,
        dueDate: '2000-01-01',
      },
    });

    const result = await service.listInvoicesForTenant('t1');
    expect(result[0].isOverdue).toBe(false);
  });

  it('getPlans barcha uchta reja narxini qaytaradi', () => {
    const { service } = createService({});
    const plans = service.getPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.plan)).toEqual([TenantPlan.START, TenantPlan.PROFESSIONAL, TenantPlan.ENTERPRISE]);
  });
});
