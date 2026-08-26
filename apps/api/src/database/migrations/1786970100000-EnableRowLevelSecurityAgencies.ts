import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `agencies` uchun RLS — `EnableRowLevelSecurityBookingGroups1786960100000`dagi
 * "to'g'ridan-to'g'ri tenant_id" naqshi bilan bir xil (o'zining `tenant_id`
 * ustuni bor, farzand jadval emas). `ALTER DEFAULT PRIVILEGES` tufayli
 * `hotel_saas_app` roliga GRANT allaqachon avtomatik berilgan — bu yerda
 * faqat RLS'ni yoqish va policy yaratish kifoya.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityAgencies1786970100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityAgencies1786970100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "agencies" TO "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `ALTER TABLE "agencies" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "agencies"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "agencies"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agencies" DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "agencies" FROM "${APP_ROLE}"`,
    );
  }
}
