import { MigrationInterface, QueryRunner } from 'typeorm';

// "Folio One Intelligence" panelida foydalanuvchi yopgan tavsiyalar.
//
// UNIQUE (user_id, property_id, insight_id) — bir foydalanuvchi bir mulkdagi
// bir tavsiyani faqat bir marta yopib turadi. Qayta yopilganda yangi qator
// emas, mavjud qatorning `dismissed_at`/`severity` maydonlari yangilanadi.
//
// `user_id` FK CASCADE — xodim o'chirilsa uning yopishlari ham ma'nosiz.
export class AddInsightDismissals1788300000000 implements MigrationInterface {
  name = 'AddInsightDismissals1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "insight_dismissals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "insight_id" character varying(64) NOT NULL,
        "severity" character varying(16) NOT NULL,
        "dismissed_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_insight_dismissals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_insight_dismissals_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_insight_dismissals_property" FOREIGN KEY ("property_id")
          REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_insight_dismissals_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_insight_dismissals_user_property_insight" ON "insight_dismissals" ("user_id", "property_id", "insight_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insight_dismissals_tenant_property" ON "insight_dismissals" ("tenant_id", "property_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insight_dismissals_tenant_property"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_insight_dismissals_user_property_insight"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "insight_dismissals"`);
  }
}
