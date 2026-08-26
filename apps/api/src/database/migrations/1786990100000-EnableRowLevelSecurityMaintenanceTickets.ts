import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `maintenance_tickets` uchun RLS — `EnableRowLevelSecurityFunctionSpaces`
 * bilan bir xil "to'g'ridan-to'g'ri tenant_id" naqshi (jadval o'zining
 * `tenant_id` ustuniga ega, farzand jadval emas).
 */

const APP_ROLE = 'hotel_saas_app';
const TABLE = 'maintenance_tickets';

export class EnableRowLevelSecurityMaintenanceTickets1786990100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityMaintenanceTickets1786990100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "${TABLE}" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "${TABLE}"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "${TABLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "${TABLE}" FROM "${APP_ROLE}"`,
    );
  }
}
