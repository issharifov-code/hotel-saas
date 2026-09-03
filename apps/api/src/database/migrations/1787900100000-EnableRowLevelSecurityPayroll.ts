import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `payroll_runs` — DIRECT_TABLE naqshi (o'zining `tenant_id` ustuni bor).
 * `payslip_entries` — CHILD_TABLE naqshi (o'z `tenant_id` ustuni yo'q, faqat
 * `payroll_run_id` FK bor) — tenant izolyatsiyasi ota jadval (`payroll_runs`)
 * orqali EXISTS subquery bilan tekshiriladi, `channel_room_type_mappings`→
 * `channels` naqshi bo'yicha.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityPayroll1787900100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityPayroll1787900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "payroll_runs" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "payroll_runs"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "payslip_entries" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payslip_entries" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "payslip_entries"
      USING (
        EXISTS (
          SELECT 1 FROM "payroll_runs" parent
          WHERE parent.id = "payslip_entries"."payroll_run_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "payroll_runs" parent
          WHERE parent.id = "payslip_entries"."payroll_run_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "payslip_entries"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payslip_entries" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "payslip_entries" FROM "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "payroll_runs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll_runs" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "payroll_runs" FROM "${APP_ROLE}"`,
    );
  }
}
