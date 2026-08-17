import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `rate_plans` uchun RLS — `EnableRowLevelSecurity1786691886342`dagi
 * "to'g'ridan-to'g'ri tenant_id" naqshi bilan bir xil (o'zining `tenant_id`
 * ustuni bor, farzand jadval emas). `ALTER DEFAULT PRIVILEGES` tufayli
 * `hotel_saas_app` roliga GRANT allaqachon avtomatik berilgan — bu yerda
 * faqat RLS'ni yoqish va policy yaratish kifoya.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityRatePlans1786900100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityRatePlans1786900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_plans" TO "${APP_ROLE}"`);

    await queryRunner.query(`ALTER TABLE "rate_plans" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "rate_plans"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "rate_plans"`);
    await queryRunner.query(`ALTER TABLE "rate_plans" DISABLE ROW LEVEL SECURITY`);

    await queryRunner.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON "rate_plans" FROM "${APP_ROLE}"`);
  }
}
