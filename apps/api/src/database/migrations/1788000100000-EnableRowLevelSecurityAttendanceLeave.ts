import { MigrationInterface, QueryRunner } from 'typeorm';

// Ikkalasi ham DIRECT_TABLE naqshi (o'z `tenant_id` ustunlari bor) —
// `payroll_runs`'dagi bir xil, oddiy tenant_isolation policy.
const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityAttendanceLeave1788000100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityAttendanceLeave1788000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "attendance_records" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "attendance_records"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "leave_requests" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "leave_requests"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "leave_requests"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "leave_requests" FROM "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "attendance_records"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "attendance_records" FROM "${APP_ROLE}"`,
    );
  }
}
