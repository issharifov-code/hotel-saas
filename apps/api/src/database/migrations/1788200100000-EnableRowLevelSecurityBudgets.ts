import { MigrationInterface, QueryRunner } from 'typeorm';

// `budgets` — DIRECT_TABLE naqshi (o'z `tenant_id` ustuni bor), ya'ni
// `attendance_records`/`payroll_runs` bilan bir xil, oddiy tenant_isolation
// policy. Budjet — tijorat jihatdan nozik ma'lumot, shuning uchun RLS bu
// yerda ayniqsa muhim.
const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityBudgets1788200100000
  implements MigrationInterface
{
  name = 'EnableRowLevelSecurityBudgets1788200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "budgets" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(`ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "budgets"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "budgets"`,
    );
    await queryRunner.query(`ALTER TABLE "budgets" DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "budgets" FROM "${APP_ROLE}"`,
    );
  }
}
