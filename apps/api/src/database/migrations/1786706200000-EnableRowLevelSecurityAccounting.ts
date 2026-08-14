import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounting jadvallari uchun RLS — `EnableRowLevelSecurity1786691886342`
 * migratsiyasidagi aynan bir xil naqsh (pattern) davomi.
 *
 * `accounts` va `journal_entries` — to'g'ridan-to'g'ri `tenant_id` ustuniga
 * ega jadvallar. `journal_entry_lines` — o'zining `tenant_id`si yo'q,
 * `journal_entry_id -> journal_entries` orqali tenant'ga bog'liq "farzand"
 * jadval.
 *
 * `hotel_saas_app` roliga GRANT'lar avvalgi migratsiyadagi
 * `ALTER DEFAULT PRIVILEGES` orqali yangi jadvallarga avtomatik qo'llanilgan
 * bo'lishi kerak, lekin ishonchli bo'lish uchun bu yerda ham aniq GRANT
 * beriladi (idempotent — mavjud grant ustiga qayta berish xavfsiz).
 */

const DIRECT_TENANT_TABLES = ['accounts', 'journal_entries'];

const CHILD_TABLES: Array<[string, string, string]> = [
  ['journal_entry_lines', 'journal_entry_id', 'journal_entries'],
];

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityAccounting1786706200000 implements MigrationInterface {
  name = 'EnableRowLevelSecurityAccounting1786706200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "accounts", "journal_entries", "journal_entry_lines" TO "${APP_ROLE}"`,
    );

    for (const table of DIRECT_TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    for (const [table, fkColumn, parentTable] of CHILD_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (EXISTS (
          SELECT 1 FROM "${parentTable}" parent
          WHERE parent.id = "${table}"."${fkColumn}"
            AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM "${parentTable}" parent
          WHERE parent.id = "${table}"."${fkColumn}"
            AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        ))
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table] of CHILD_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    for (const table of DIRECT_TENANT_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON "accounts", "journal_entries", "journal_entry_lines" FROM "${APP_ROLE}"`,
    );
  }
}
