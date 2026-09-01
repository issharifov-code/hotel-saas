import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantStatus, TenantPlan } from './entities/tenant.entity';

// Bu modulda avval umuman test yo'q edi (sayqal auditi, Critical topilma) —
// ayniqsa `createTenantWithDefaultProperty` xavfli: u login/ro'yxatdan o'tishdan
// OLDIN, tenant kontekstisiz ishlaydigan yagona joy bo'lib, RLS session
// o'zgaruvchisini ('app.tenant_id') QO'LDA o'rnatadi (rls-context.service.ts
// bilan bir xil mexanizm) — shu qadam sinovdan o'tmasa, yangi ro'yxatdan
// o'tgan tenant'ning standart property yozuvi RLS tomonidan "ko'rinmas" bo'lib
// qolishi (yoki aksincha, boshqa tenant kontekstida yozilib ketishi) mumkin edi.
describe('TenantsService', () => {
  function createService(
    opts: {
      existingBySubdomain?: Record<string, unknown> | null;
      findByIdResult?: Record<string, unknown> | null;
    } = {},
  ) {
    const savedEntities: Record<string, unknown>[] = [];
    const manager = {
      create: jest
        .fn()
        .mockImplementation(
          (_entityClass: unknown, data: Record<string, unknown>) => ({
            ...data,
          }),
        ),
      save: jest.fn().mockImplementation((entity: Record<string, unknown>) => {
        const saved = {
          id: entity.id ?? `generated-${savedEntities.length}`,
          ...entity,
        };
        savedEntities.push(saved);
        return Promise.resolve(saved);
      }),
      query: jest.fn().mockResolvedValue(undefined),
    };
    const tenantRepo = {
      findOneBy: jest
        .fn()
        .mockImplementation((where: Record<string, unknown>) => {
          if ('subdomain' in where)
            return Promise.resolve(opts.existingBySubdomain ?? null);
          if ('id' in where)
            return Promise.resolve(opts.findByIdResult ?? null);
          return Promise.resolve(null);
        }),
      find: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation((entity: Record<string, unknown>) =>
          Promise.resolve(entity),
        ),
      manager: {
        transaction: jest
          .fn()
          .mockImplementation((cb: (m: typeof manager) => unknown) =>
            cb(manager),
          ),
      },
    };
    const propertyRepo = {};
    const accountingService = {
      seedDefaultChartOfAccounts: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TenantsService(
      tenantRepo as never,
      propertyRepo as never,
      accountingService as never,
    );
    return { service, tenantRepo, propertyRepo, accountingService, manager };
  }

  describe('createTenantWithDefaultProperty', () => {
    it("noto'g'ri formatdagi subdomain uchun ConflictException tashlaydi", async () => {
      const { service } = createService();
      await expect(
        service.createTenantWithDefaultProperty({
          tenantName: 'Test Hotel',
          subdomain: 'Invalid Subdomain!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('band subdomain uchun ConflictException tashlaydi', async () => {
      const { service } = createService({
        existingBySubdomain: { id: 'existing-tenant' },
      });
      await expect(
        service.createTenantWithDefaultProperty({
          tenantName: 'Test Hotel',
          subdomain: 'taken',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("tenant va standart property'ni bitta tranzaksiyada yaratadi, RLS session kontekstini QO'LDA o'rnatadi", async () => {
      const { service, accountingService, manager } = createService({
        existingBySubdomain: null,
      });
      const { tenant, property } =
        await service.createTenantWithDefaultProperty({
          tenantName: 'Yangi Hotel',
          subdomain: 'Yangi-Hotel', // kichik harfga normalizatsiya tekshiriladi
          baseCurrency: 'USD',
        });

      expect(tenant.subdomain).toBe('yangi-hotel');
      expect(tenant.status).toBe(TenantStatus.TRIAL);
      expect(tenant.plan).toBe(TenantPlan.START);
      // set_config chaqiruvi tenant SAQLANGANDAN keyin, property yozilishidan
      // OLDIN bo'lishi shart — aks holda property RLS tomonidan bloklanadi.
      expect(manager.query).toHaveBeenCalledWith(
        'SELECT set_config($1, $2, true)',
        ['app.tenant_id', tenant.id],
      );
      expect(accountingService.seedDefaultChartOfAccounts).toHaveBeenCalledWith(
        tenant.id,
        manager,
      );
      expect(property.tenantId).toBe(tenant.id);
      expect(property.currency).toBe('USD');
    });

    it("baseCurrency berilmasa standart 'UZS' ishlatadi", async () => {
      const { service } = createService({ existingBySubdomain: null });
      const { tenant } = await service.createTenantWithDefaultProperty({
        tenantName: 'Boshqa Hotel',
        subdomain: 'boshqa-hotel',
      });
      expect(tenant.baseCurrency).toBe('UZS');
    });
  });

  describe('findById', () => {
    it('topilmasa NotFoundException tashlaydi', async () => {
      const { service } = createService({ findByIdResult: null });
      await expect(service.findById('yoq')).rejects.toThrow(NotFoundException);
    });

    it("topilgan tenant'ni qaytaradi", async () => {
      const { service } = createService({
        findByIdResult: { id: 't1', name: 'Demo Hotel' },
      });
      const tenant = await service.findById('t1');
      expect(tenant).toMatchObject({ id: 't1', name: 'Demo Hotel' });
    });
  });

  describe('findBySubdomain', () => {
    it('topilmasa null qaytaradi (login oqimi buni 401 sifatida talqin qiladi)', async () => {
      const { service } = createService({ existingBySubdomain: null });
      expect(await service.findBySubdomain('yoq')).toBeNull();
    });

    it("subdomain'ni kichik harfga o'girib qidiradi", async () => {
      const { service, tenantRepo } = createService({
        existingBySubdomain: { id: 't1', subdomain: 'demo' },
      });
      await service.findBySubdomain('DEMO');
      expect(tenantRepo.findOneBy).toHaveBeenCalledWith({
        subdomain: 'demo',
      });
    });
  });

  describe('updateStatus', () => {
    it("mavjud bo'lmagan tenant uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({ findByIdResult: null });
      await expect(
        service.updateStatus('yoq', TenantStatus.SUSPENDED),
      ).rejects.toThrow(NotFoundException);
    });

    it("tenant holatini yangilaydi (masalan to'lov qilinmagach SUSPENDED)", async () => {
      const { service, tenantRepo } = createService({
        findByIdResult: { id: 't1', status: TenantStatus.ACTIVE },
      });
      const updated = await service.updateStatus('t1', TenantStatus.SUSPENDED);
      expect(updated.status).toBe(TenantStatus.SUSPENDED);
      expect(tenantRepo.save).toHaveBeenCalled();
    });
  });
});
