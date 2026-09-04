import { MigrationInterface, QueryRunner } from 'typeorm';

// Oylik budjet (moliyaviy reja) jadvali — mulk + yil + oy bo'yicha UNIQUE.
// Uch ko'rsatkich ham nullable: mehmonxona faqat o'ziga kerakligini
// rejalashtirishi mumkin (qarang budget.entity.ts izohi).
//
// `month` uchun DB darajasidagi CHECK — DTO tekshiruvi chetlab o'tilgan
// taqdirda ham (masalan kelajakda boshqa kod yo'li orqali yozilsa) bazada
// 1-12 dan tashqari oy paydo bo'lmasligi uchun.
export class AddBudgets1788200000000 implements MigrationInterface {
  name = 'AddBudgets1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "month" integer NOT NULL,
        "rooms_revenue" numeric(14,2),
        "occupancy_rate_pct" numeric(5,2),
        "adr" numeric(12,2),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budgets" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_budgets_month" CHECK ("month" >= 1 AND "month" <= 12),
        CONSTRAINT "FK_budgets_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_budgets_property" FOREIGN KEY ("property_id")
          REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_budgets_property_year_month" ON "budgets" ("property_id", "year", "month")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_budgets_tenant_property" ON "budgets" ("tenant_id", "property_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budgets_tenant_property"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_budgets_property_year_month"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets"`);
  }
}
