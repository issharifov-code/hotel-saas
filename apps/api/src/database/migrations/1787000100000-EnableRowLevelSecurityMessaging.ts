import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `message_templates` va `message_logs` uchun RLS —
 * `EnableRowLevelSecurityFunctionSpaces1786980100000`dagi "to'g'ridan-to'g'ri
 * tenant_id" naqshi bilan bir xil (ikkalasi ham o'zining `tenant_id`
 * ustuniga ega, farzand jadval emas).
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityMessaging1787000100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityMessaging1787000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['message_templates', 'message_logs']) {
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
    for (const table of ['message_logs', 'message_templates']) {
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
