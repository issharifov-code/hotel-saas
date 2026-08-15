import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `loyalty_transactions` uchun RLS — `EnableRowLevelSecurityAccounting`dagi
 * "farzand jadval" naqshi bilan bir xil: o'zining `tenant_id`si yo'q,
 * `guest_id -> guests` orqali tenant'ga bog'liq (guests jadvali RLS'i
 * `EnableRowLevelSecurity1786691886342`da allaqachon yoqilgan).
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityLoyalty1786790100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityLoyalty1786790100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_transactions" TO "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `ALTER TABLE "loyalty_transactions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "loyalty_transactions"
      USING (EXISTS (
        SELECT 1 FROM "guests" parent
        WHERE parent.id = "loyalty_transactions"."guest_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "guests" parent
        WHERE parent.id = "loyalty_transactions"."guest_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "loyalty_transactions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loyalty_transactions" DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "loyalty_transactions" FROM "${APP_ROLE}"`,
    );
  }
}
