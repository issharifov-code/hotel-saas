import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `function_spaces` va `function_space_bookings` uchun RLS —
 * `EnableRowLevelSecurityAgencies1786970100000`dagi "to'g'ridan-to'g'ri
 * tenant_id" naqshi bilan bir xil (ikkalasi ham o'zining `tenant_id`
 * ustuniga ega, farzand jadval emas). `ALTER DEFAULT PRIVILEGES` tufayli
 * `hotel_saas_app` roliga GRANT allaqachon avtomatik berilgan — bu yerda
 * faqat RLS'ni yoqish va policy yaratish kifoya.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityFunctionSpaces1786980100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityFunctionSpaces1786980100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['function_spaces', 'function_space_bookings']) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "${APP_ROLE}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['function_space_bookings', 'function_spaces']) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON "${table}" FROM "${APP_ROLE}"`,
      );
    }
  }
}
