import { RlsContextService } from './rls-context.service';

// 🔴 2026-09-05 (kod auditi): RLS tranzaksiyasi `RlsModule.forFeature`
// factory'si tomonidan GUARD'LARDAN OLDIN ochiladi, commit/rollback esa
// faqat interceptor'da — u guard'lardan KEYIN ishlaydi. Ya'ni har bir
// 401/403 bitta pool ulanishini band qilib qoldirardi.
describe('RlsContextService — javob tugaganda ulanish qaytariladi', () => {
  function createService(user?: { tenantId?: string | null }) {
    const listeners: Record<string, (() => void)[]> = {};
    const res = {
      once: (event: string, cb: () => void) => {
        (listeners[event] ??= []).push(cb);
      },
    };
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { query: jest.fn().mockResolvedValue(undefined) },
    };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const service = new RlsContextService(
      { user, res } as never,
      dataSource as never,
    );
    const yopish = async () => {
      for (const cb of listeners.close ?? []) cb();
      // rollback() async — mikro-navbatni bo'shatamiz
      await Promise.resolve();
      await Promise.resolve();
    };
    return { service, queryRunner, yopish };
  }

  it('guard rad etib, commit/rollback chaqirilmasa ham ulanish bo\'shatiladi', async () => {
    const { service, queryRunner, yopish } = createService();
    await service.getManager();

    // Interceptor umuman ishlamadi (guard 403 tashladi) — faqat javob yopildi.
    await yopish();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it("interceptor commit qilgan bo'lsa, javob yopilishi qo'shimcha rollback qilmaydi", async () => {
    const { service, queryRunner, yopish } = createService();
    await service.getManager();
    await service.commit();

    await yopish();

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it("hech qanday RLS repository ishlatilmasa, ulanish umuman ochilmaydi", async () => {
    const { service, queryRunner } = createService();
    // `getManager()` chaqirilmadi — applyTenantContext ham no-op bo'lishi kerak.
    await service.applyTenantContext();
    expect(queryRunner.connect).not.toHaveBeenCalled();
  });

  it("tenant bo'lsa app.tenant_id o'rnatiladi", async () => {
    const { service, queryRunner } = createService({ tenantId: 't1' });
    await service.getManager();
    await service.applyTenantContext();
    expect(queryRunner.manager.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, true)',
      ['app.tenant_id', 't1'],
    );
  });
});
