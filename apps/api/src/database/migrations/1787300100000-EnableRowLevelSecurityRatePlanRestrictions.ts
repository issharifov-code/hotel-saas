import { MigrationInterface, QueryRunner } from 'typeorm';

// `rate_plan_restrictions` — CHILD_TABLE RLS patterni: jadvalning o'zida
// `tenant_id` ustuni yo'q, faqat `rate_plan_id` FK bor. Shuning uchun
// tenant izolyatsiyasi ota jadval (`rate_plans`) orqali EXISTS subquery
// bilan tekshiriladi — xuddi `loyalty_transactions` (parent = `guests`)
// uchun qilingani kabi.
export class EnableRowLevelSecurityRatePlanRestrictions1787300100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityRatePlanRestrictions1787300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_plan_restrictions" TO "hotel_saas_app"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_restrictions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "rate_plan_restrictions"
      USING (
        EXISTS (
          SELECT 1 FROM "rate_plans" parent
          WHERE parent.id = "rate_plan_restrictions"."rate_plan_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "rate_plans" parent
          WHERE parent.id = "rate_plan_restrictions"."rate_plan_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "rate_plan_restrictions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_restrictions" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "rate_plan_restrictions" FROM "hotel_saas_app"`,
    );
  }
}
