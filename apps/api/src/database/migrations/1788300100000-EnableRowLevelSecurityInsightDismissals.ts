import { MigrationInterface, QueryRunner } from 'typeorm';

// `insight_dismissals` — DIRECT_TABLE naqshi (o'z `tenant_id` ustuni bor),
// `budgets` bilan bir xil oddiy tenant_isolation policy.
//
// Eslatma: policy TENANT darajasida ishlaydi, foydalanuvchi darajasida emas.
// Bir tenant ichidagi foydalanuvchilarni bir-biridan ajratish RLS'ning
// vazifasi emas — u so'rovlarda `userId` sharti bilan qilinadi
// (`ReportsService`). RLS bu yerda tenantlararo sizishning oldini oladi.
const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityInsightDismissals1788300100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityInsightDismissals1788300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "insight_dismissals" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dismissals" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "insight_dismissals"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "insight_dismissals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dismissals" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "insight_dismissals" FROM "${APP_ROLE}"`,
    );
  }
}
