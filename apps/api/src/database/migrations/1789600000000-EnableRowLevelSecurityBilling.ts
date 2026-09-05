import { MigrationInterface, QueryRunner } from 'typeorm';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). `subscription_invoices` —
// `tenant_id` ustuni bor, ya'ni tenantga tegishli MOLIYAVIY jadval, lekin
// unda RLS umuman yoqilmagan edi. `hotel_saas_app` roli esa unga to'liq
// SELECT/INSERT/UPDATE/DELETE huquqiga ega.
//
// Bugun bu jadvalga faqat `PlatformAdminGuard` ortidagi yo'llardan
// yetiladi, lekin `BillingService.findInvoiceOrThrow` tenant filtrisiz
// `findOneBy({ id })` qiladi. Ya'ni tenant tomonga "mening hisob-fakturam
// / to'lash" yo'li ulangan zahoti (entity izohi to'lov shlyuzi kelishini
// aytadi) bir mehmonxona egasi boshqasining obuna summalarini o'qiy va
// o'zgartira olardi — bazada uni to'sadigan hech narsa yo'q edi.
//
// ILDIZ SABAB. Boshlang'ich `EnableRowLevelSecurity` migratsiyasidagi
// `ALTER DEFAULT PRIVILEGES` har YANGI jadvalga avtomatik DML beradi,
// RLS siyosati esa alohida, qo'lda qadam. Ya'ni jadval qo'shish
// FAIL-OPEN: huquq o'z-o'zidan keladi, himoya esa kelmaydi. Aynan shu
// sababdan `subscription_invoices` (1786800000000) va `demo_requests`
// (1787600000000) sirg'alib o'tgan.
//
// Bu migratsiya:
//   1. `subscription_invoices` ga RLS + `tenant_isolation` siyosatini
//      qo'shadi (`users` naqshi bilan: aniq nomlangan bypass);
//   2. `ALTER DEFAULT PRIVILEGES` ni BEKOR QILADI — bundan keyin har
//      jadval o'z migratsiyasida aniq GRANT olishi kerak;
//   3. RLS'siz qolgan control-plane jadvallardagi ortiqcha DML huquqini
//      olib tashlaydi (`permissions`, `migrations` — ilova ularni faqat
//      o'qiydi).
const APP_ROLE = 'hotel_saas_app';

const POLICY = `
  current_setting('app.billing_bypass', true) = 'on'
  OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
`;

export class EnableRowLevelSecurityBilling1789600000000
  implements MigrationInterface
{
  name = 'EnableRowLevelSecurityBilling1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_invoices" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "subscription_invoices"
      USING (${POLICY})
      WITH CHECK (${POLICY})
    `);

    // Yangi jadval avtomatik huquq olmasin — fail-open naqshni yopamiz.
    await queryRunner.query(`
      DO $$ BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${APP_ROLE}"',
          current_user);
      END $$;
    `);

    // Ilova bu ikki jadvalni faqat o'qiydi (ruxsatlar katalogi va
    // migratsiya tarixi) — yozish huquqi keraksiz.
    await queryRunner.query(
      `REVOKE INSERT, UPDATE, DELETE ON "permissions" FROM "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `REVOKE INSERT, UPDATE, DELETE ON "migrations" FROM "${APP_ROLE}"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT INSERT, UPDATE, DELETE ON "migrations" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `GRANT INSERT, UPDATE, DELETE ON "permissions" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"',
          current_user);
      END $$;
    `);
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "subscription_invoices"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_invoices" DISABLE ROW LEVEL SECURITY`,
    );
  }
}
