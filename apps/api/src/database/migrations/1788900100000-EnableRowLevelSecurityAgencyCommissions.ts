import { MigrationInterface, QueryRunner } from 'typeorm';

// Ikkala jadval ham DIRECT_TABLE naqshi (o'z `tenant_id` ustuni bor) —
// `budgets`/`payroll_runs` bilan bir xil, oddiy tenant_isolation policy.
//
// Komissiya — shartnoma sharti va pul ma'lumoti, ya'ni tijorat jihatdan
// nozik: bir mehmonxona ikkinchisining agentlik kelishuvini ko'rmasligi
// kerak, shuning uchun RLS bu yerda majburiy.
const APP_ROLE = 'hotel_saas_app';
const TABLES = ['agency_commissions', 'agency_commission_payments'];

export class EnableRowLevelSecurityAgencyCommissions1788900100000
  implements MigrationInterface
{
  name = 'EnableRowLevelSecurityAgencyCommissions1788900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "${APP_ROLE}"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
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
