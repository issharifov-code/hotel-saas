import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `night_audit_runs` uchun RLS — `EnableRowLevelSecurityRatePlans1786900100000`
 * bilan bir xil "to'g'ridan-to'g'ri tenant_id" naqshi (o'zining `tenant_id`
 * ustuni bor, farzand jadval emas). `ALTER DEFAULT PRIVILEGES` tufayli
 * `hotel_saas_app` roliga GRANT allaqachon avtomatik berilgan — bu yerda
 * faqat RLS'ni yoqish va policy yaratish kifoya.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityNightAudit1786950100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityNightAudit1786950100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "night_audit_runs" TO "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "night_audit_runs"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "night_audit_runs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "night_audit_runs" FROM "${APP_ROLE}"`,
    );
  }
}
