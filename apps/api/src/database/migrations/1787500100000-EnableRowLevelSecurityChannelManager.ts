import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `channels` — DIRECT_TABLE naqshi (o'zining `tenant_id` ustuni bor,
 * `EnableRowLevelSecurityCorporateAccounts` bilan bir xil). `channel_room_
 * type_mappings` va `channel_sync_logs` — CHILD_TABLE naqshi (o'z `tenant_id`
 * ustuni yo'q, faqat `channel_id` FK bor) — tenant izolyatsiyasi ota jadval
 * (`channels`) orqali EXISTS subquery bilan tekshiriladi, xuddi
 * `rate_plan_restrictions`→`rate_plans` naqshi kabi.
 */

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityChannelManager1787500100000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityChannelManager1787500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "channels" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(`ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "channels"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "channel_room_type_mappings" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_room_type_mappings" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "channel_room_type_mappings"
      USING (
        EXISTS (
          SELECT 1 FROM "channels" parent
          WHERE parent.id = "channel_room_type_mappings"."channel_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "channels" parent
          WHERE parent.id = "channel_room_type_mappings"."channel_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "channel_sync_logs" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_sync_logs" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "channel_sync_logs"
      USING (
        EXISTS (
          SELECT 1 FROM "channels" parent
          WHERE parent.id = "channel_sync_logs"."channel_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "channels" parent
          WHERE parent.id = "channel_sync_logs"."channel_id"
          AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "channel_sync_logs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_sync_logs" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "channel_sync_logs" FROM "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "channel_room_type_mappings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_room_type_mappings" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "channel_room_type_mappings" FROM "${APP_ROLE}"`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "channels"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "channels" FROM "${APP_ROLE}"`,
    );
  }
}
