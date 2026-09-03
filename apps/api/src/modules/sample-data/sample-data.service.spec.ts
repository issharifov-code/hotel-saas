import { NotFoundException } from '@nestjs/common';
import { SampleDataService } from './sample-data.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { LoyaltyTier } from '../guests/entities/guest.entity';
import { LoyaltyTransactionType } from '../guests/entities/loyalty-transaction.entity';

// SampleDataService haqiqiy DB o'rniga o'zining tranzaksiyasini ochadi
// (dataSource.manager.transaction) va `manager.getRepository(Entity)` orqali
// yozadi — LoyaltyService testidagi kabi (loyalty.service.spec.ts) xotirada
// ishlaydigan minimal mock kifoya, lekin bu yerda ko'plab entity turlari
// bo'lgani uchun generic "fake manager" yasaymiz: har bir `getRepository`
// chaqiruvi shu entity nomi ostida saqlangan yozuvlar ro'yxatiga yozadi.
describe('SampleDataService', () => {
  function createFakeManager() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const saved: Record<string, Array<Record<string, unknown>>> = {};
    const updateCalls: Array<{
      entity: string;
      criteria: unknown;
      partial: unknown;
    }> = [];
    let idCounter = 0;
    const nextId = () => `id-${++idCounter}`;

    // Haqiqiy entity klasslarida ustun default'lari (masalan `@Column({ default: 0 })`)
    // DB darajasida ishlaydi — bu yerda haqiqiy DB yo'q, shuning uchun `SampleDataService`
    // to'g'ridan-to'g'ri tayanadigan default'larni (Guest.loyaltyPoints va h.k.) qo'lda
    // taqlid qilamiz, aks holda `guest.loyaltyPoints += points` NaN beradi.
    const ENTITY_DEFAULTS: Record<string, Record<string, unknown>> = {
      Guest: {
        loyaltyPoints: 0,
        lifetimePoints: 0,
        loyaltyTier: LoyaltyTier.BRONZE,
      },
    };

    const repoFor = (entityClass: { name: string }) => {
      const name = entityClass.name;
      if (!saved[name]) saved[name] = [];
      const defaults = ENTITY_DEFAULTS[name];
      return {
        create: (data: unknown) =>
          Array.isArray(data)
            ? (data as unknown[]).map((d) => ({
                ...defaults,
                ...(d as object),
              }))
            : { ...defaults, ...(data as object) },
        save: jest.fn((entityOrEntities: unknown) => {
          const isArray = Array.isArray(entityOrEntities);
          const list = (
            isArray ? entityOrEntities : [entityOrEntities]
          ) as Array<Record<string, unknown>>;
          const result = list.map((e) => {
            const withId = {
              ...e,
              id: (e.id as string | undefined) ?? nextId(),
            };
            saved[name].push(withId);
            return withId;
          });
          return Promise.resolve(isArray ? result : result[0]);
        }),
      };
    };

    const manager = {
      query: jest.fn((sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return Promise.resolve([]);
      }),
      getRepository: jest.fn((entityClass: { name: string }) =>
        repoFor(entityClass),
      ),
      update: jest.fn(
        (
          entityClass: { name: string },
          criteria: unknown,
          partial: unknown,
        ) => {
          updateCalls.push({ entity: entityClass.name, criteria, partial });
          return Promise.resolve({});
        },
      ),
    };

    return { manager, queries, saved, updateCalls };
  }

  function createService() {
    const fake = createFakeManager();
    const dataSource = {
      manager: {
        transaction: jest.fn(async (cb: (manager: unknown) => Promise<void>) =>
          cb(fake.manager),
        ),
      },
    };
    const tenantRepo = { findOneBy: jest.fn() };
    const service = new SampleDataService(
      dataSource as never,
      tenantRepo as never,
    );
    return { service, dataSource, tenantRepo, ...fake };
  }

  describe('seedForTenant', () => {
    const params = {
      tenantId: 't1',
      propertyId: 'p1',
      ownerUserId: 'u1',
      currency: 'UZS',
    };

    it("tranzaksiya boshida app.tenant_id'ni RLS uchun o'rnatadi", async () => {
      const { service, queries } = createService();
      await service.seedForTenant(params);
      const sqlMatcher: unknown = expect.stringContaining('set_config');
      expect(queries[0]).toMatchObject({
        sql: sqlMatcher,
        params: ['app.tenant_id', 't1'],
      });
    });

    it('kutilgan miqdorda namunaviy yozuvlarni yaratadi', async () => {
      const { service, saved } = createService();
      await service.seedForTenant(params);

      expect(saved.RoomType).toHaveLength(3);
      expect(saved.Room).toHaveLength(6);
      expect(saved.RatePlan).toHaveLength(2);
      expect(saved.Guest.length).toBeGreaterThanOrEqual(5); // + loyalty yangilanishi uchun qo'shimcha save'lar
      expect(saved.Booking).toHaveLength(6);
      expect(saved.Warehouse).toHaveLength(1);
      expect(saved.Supplier).toHaveLength(1);
      expect(saved.StockItem).toHaveLength(3);
      expect(saved.PurchaseOrder).toHaveLength(1);
      expect(saved.PurchaseOrderItem).toHaveLength(3);
      expect(saved.StockLot).toHaveLength(3);
      expect(saved.StockTransaction).toHaveLength(6);
      expect(saved.PosOutlet).toHaveLength(1);
      expect(saved.MenuItem).toHaveLength(4);
      expect(saved.PosOrder).toHaveLength(2);
      expect(saved.PosOrderItem).toHaveLength(4);
      expect(saved.Invoice).toHaveLength(3);
      expect(saved.InvoiceLine).toHaveLength(4);
      expect(saved.InvoicePayment).toHaveLength(2);
      expect(saved.HousekeepingTask).toHaveLength(2);
      expect(saved.LoyaltyTransaction).toHaveLength(2);
    });

    it("faqat to'lov qilingan hisob-fakturalar uchun haqiqiy formula bilan ball beradi", async () => {
      const { service, saved } = createService();
      await service.seedForTenant(params);

      // Aziz — invoiceB (700000, PAID): 700000 * 0.1 = 70000 ball -> PLATINUM
      const azizEntries = saved.Guest.filter(
        (g) => g.fullName === 'Aziz Karimov',
      );
      const finalAziz = azizEntries[azizEntries.length - 1];
      expect(finalAziz.loyaltyPoints).toBe(70000);
      expect(finalAziz.lifetimePoints).toBe(70000);
      expect(finalAziz.loyaltyTier).toBe(LoyaltyTier.PLATINUM);

      // Malika — invoiceD (1155000, PAID): 1155000 * 0.1 = 115500 ball -> PLATINUM
      const malikaEntries = saved.Guest.filter(
        (g) => g.fullName === 'Malika Yusupova',
      );
      const finalMalika = malikaEntries[malikaEntries.length - 1];
      expect(finalMalika.loyaltyPoints).toBe(115500);
      expect(finalMalika.loyaltyTier).toBe(LoyaltyTier.PLATINUM);

      // John va Elyor va Nodira uchun to'lov yo'q — loyalty tranzaksiyasi yo'q
      const johnEntries = saved.Guest.filter(
        (g) => g.fullName === 'John Smith',
      );
      expect(johnEntries.every((g) => (g.loyaltyPoints as number) === 0)).toBe(
        true,
      );

      expect(
        saved.LoyaltyTransaction.every(
          (tx) => tx.type === LoyaltyTransactionType.EARN,
        ),
      ).toBe(true);
    });

    it("oxirida tenant'ning hasSampleData=true qilib belgilaydi", async () => {
      const { service, updateCalls } = createService();
      await service.seedForTenant(params);

      const tenantUpdate = updateCalls.find((c) => c.entity === Tenant.name);
      expect(tenantUpdate).toMatchObject({
        criteria: { id: 't1' },
        partial: { hasSampleData: true },
      });
    });
  });

  describe('removeSampleData', () => {
    it("mavjud bo'lmagan tenant uchun NotFoundException tashlaydi va tranzaksiya ochilmaydi", async () => {
      const { service, tenantRepo, dataSource } = createService();
      tenantRepo.findOneBy.mockResolvedValue(null);

      await expect(service.removeSampleData('unknown')).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.manager.transaction).not.toHaveBeenCalled();
    });

    it("tranzaksion ma'lumotlarni o'chiradi, xonalarni bo'shatadi va hasSampleData=false qiladi", async () => {
      const { service, tenantRepo, queries, updateCalls } = createService();
      tenantRepo.findOneBy.mockResolvedValue({ id: 't1', hasSampleData: true });

      await service.removeSampleData('t1');

      // Birinchi so'rov — RLS uchun app.tenant_id
      const sqlMatcher: unknown = expect.stringContaining('set_config');
      expect(queries[0]).toMatchObject({
        sql: sqlMatcher,
        params: ['app.tenant_id', 't1'],
      });

      const sqlList = queries.map((q) => q.sql);
      const idxOf = (needle: string) =>
        sqlList.findIndex((sql) => sql.includes(needle));

      // Bolalar jadvallari ota-jadvaldan OLDIN o'chirilishi kerak (FK buzilmasligi uchun).
      expect(idxOf('loyalty_transactions')).toBeGreaterThan(0);
      expect(idxOf('loyalty_transactions')).toBeLessThan(
        idxOf('DELETE FROM guests'),
      );
      expect(idxOf('invoice_lines')).toBeLessThan(
        idxOf('DELETE FROM invoices'),
      );
      expect(idxOf('invoice_payments')).toBeLessThan(
        idxOf('DELETE FROM invoices'),
      );
      expect(idxOf('pos_order_items')).toBeLessThan(
        idxOf('DELETE FROM pos_orders'),
      );
      expect(idxOf('purchase_order_items')).toBeLessThan(
        idxOf('DELETE FROM purchase_orders'),
      );

      // Xona turlari/xonalar o'chirilmaydi — faqat holat tozalanadi.
      expect(
        sqlList.some((sql) => sql.includes('DELETE FROM room_types')),
      ).toBe(false);
      expect(sqlList.some((sql) => sql.includes('DELETE FROM rooms'))).toBe(
        false,
      );
      const roomsUpdate = queries.find((q) => q.sql.includes('UPDATE rooms'));
      expect(roomsUpdate).toBeDefined();
      expect(roomsUpdate?.sql).toContain("status = 'available'");
      expect(roomsUpdate?.sql).toContain("housekeeping_status = 'clean'");
      expect(roomsUpdate?.params).toEqual(['t1']);

      const tenantUpdate = updateCalls.find((c) => c.entity === Tenant.name);
      expect(tenantUpdate).toMatchObject({
        criteria: { id: 't1' },
        partial: { hasSampleData: false },
      });
    });
  });
});
