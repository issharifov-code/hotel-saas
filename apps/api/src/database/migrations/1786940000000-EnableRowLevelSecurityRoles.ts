import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `roles` va `user_roles` jadvallariga Row-Level Security qo'shadi.
 *
 * Bu ikkala jadval boshlang'ich `EnableRowLevelSecurity` migratsiyasida
 * ATAYLAB tashlab ketilgan edi (o'sha migratsiyaning izohiga qarang) —
 * "keyingi bosqichda alohida (bootstrap-bypass) dizayn bilan qo'shiladi"
 * deb yozilgan, lekin hech qachon amalga oshirilmagan edi.
 *
 * Tenant izolyatsiyasi shu paytgacha FAQAT ilova qatlamida (RolesService'ning
 * har bir metodidagi `tenantId` filtri) ta'minlangan edi — ma'lumotlar bazasi
 * darajasida hech qanday himoya yo'q edi. Amalda bironta ham xato/ekspluatatsiya
 * topilmagan (audit — 2026-08-24), lekin bu aynan RLS himoya qilishi kerak
 * bo'lgan xato sinfi: agar kimdir kelajakda biror RolesService metodiga
 * tenantId filtrini qo'shishni unutib qo'ysa, boshqa tenant'ning
 * rollari/ruxsatlari sizib chiqishi mumkin edi.
 *
 * `roles.tenant_id` NULLABLE (platforma darajasidagi rollar uchun mo'ljallangan),
 * lekin bu hech qachon amalda ishlatilmagan (platforma admin `User.isPlatformAdmin`
 * bayrog'i orqali aniqlanadi, alohida Role orqali emas — PermissionsGuard buni
 * to'g'ridan-to'g'ri tekshirib, RolesService'ga umuman murojaat qilmaydi). Shu
 * sabab boshqa DIRECT_TENANT_TABLES bilan bir xil oddiy siyosat yetarli.
 *
 * RolesService'ning HAR BIR metodi endi o'zining `withTenantContext()` orqali
 * `set_config('app.tenant_id', ...)`ni qo'lda, o'z tranzaksiyasi ichida
 * o'rnatadi (roles.service.ts'ga qarang) — shu bilan bu servis ambient
 * so'rov-darajasidagi RLS kontekstidan (RlsContextService) MUSTAQIL ishlaydi,
 * chunki AuthService.registerTenant orqali AUTENTIFIKATSIYADAN OLDIN ham
 * chaqiriladi (standart rollarni seed qilish/tenant egasini tayinlash).
 *
 * `role_permissions` — Role<->Permission ko'p-ko'pga bog'lovchi jadval
 * (TypeORM `@JoinTable` orqali avtomatik boshqariladi, o'zining tenant_id
 * ustuni yo'q) — boshlang'ich migratsiyadagi CHILD_TABLES bilan bir xil
 * naqsh bo'yicha, `role_id` orqali `roles.tenant_id`ga bog'lab himoyalanadi.
 * RolesService'dagi barcha yozuvlar (`roleRepo.save(role)` cascade orqali)
 * `withTenantContext()`ning BIR XIL tranzaksiyasi/manager'i ichida sodir
 * bo'lgani uchun, bu yerga qo'shimcha kod o'zgarishi kerak emas.
 */

const DIRECT_TABLES = ['roles', 'user_roles'];

export class EnableRowLevelSecurityRoles1786940000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityRoles1786940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of DIRECT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    await queryRunner.query(
      `ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "role_permissions"
      USING (EXISTS (
        SELECT 1 FROM "roles" parent
        WHERE parent.id = "role_permissions"."role_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "roles" parent
        WHERE parent.id = "role_permissions"."role_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "role_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DISABLE ROW LEVEL SECURITY`,
    );

    for (const table of DIRECT_TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
