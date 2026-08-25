import { MigrationInterface, QueryRunner } from 'typeorm';

// Night Audit — mehmonxona PMS'larida standart "kunni yopish" (end-of-day)
// jarayoni. Har bir property endi o'zining joriy "biznes sanasi"
// (business_date)ni yuritadi (mavjud property'lar uchun CURRENT_DATE bilan
// boshlanadi). `night_audit_runs` — har bir ishga tushirilishning
// o'zgarmas audit yozuvi (bandlik/ADR/RevPAR/no-show soni), (property_id,
// audit_date) bo'yicha UNIQUE — bitta kunni ikki marta yopib bo'lmaydi.
// RLS keyingi migratsiyada — `EnableRowLevelSecurityNightAudit1786950100000`.
export class AddNightAudit1786950000000 implements MigrationInterface {
  name = 'AddNightAudit1786950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" ADD "business_date" date NOT NULL DEFAULT CURRENT_DATE`,
    );

    await queryRunner.query(`
      CREATE TABLE "night_audit_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "audit_date" date NOT NULL,
        "total_rooms" integer NOT NULL,
        "occupied_rooms" integer NOT NULL,
        "occupancy_rate_pct" numeric(5,2) NOT NULL,
        "adr" numeric(12,2) NOT NULL,
        "rev_par" numeric(12,2) NOT NULL,
        "room_revenue" numeric(12,2) NOT NULL,
        "no_shows_processed" integer NOT NULL DEFAULT 0,
        "run_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_night_audit_runs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_night_audit_runs_property_date" UNIQUE ("property_id", "audit_date")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_night_audit_runs_tenant_property" ON "night_audit_runs" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" ADD CONSTRAINT "FK_night_audit_runs_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" DROP CONSTRAINT "FK_night_audit_runs_property_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_night_audit_runs_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "night_audit_runs"`);
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "business_date"`,
    );
  }
}
