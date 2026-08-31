import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `corporate_accounts` uchun RLS — `EnableRowLevelSecurityAgencies1786970100000`dagi
 * "to'g'ridan-to'g'ri tenant_id" naqshi bilan bir xil (o'zining `tenant_id`
 * ustuni bor, farzand jadval emas). `ALTER DEFAULT PRIVILEGES` tufayli
 * `hotel_saas_app` roliga GRANT allaqachon avtomatik berilgan — bu yerda
 * faqat RLS'ni yoqish va policy yaratish kifoya.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityCorporateAccounts1787100100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityCorporateAccounts1787100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "corporate_accounts" TO "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "corporate_accounts"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "corporate_accounts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "corporate_accounts" FROM "${APP_ROLE}"`,
    );
  }
}
