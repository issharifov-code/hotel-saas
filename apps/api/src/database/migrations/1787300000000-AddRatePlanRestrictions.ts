import { MigrationInterface, QueryRunner } from 'typeorm';

// Narx rejasi cheklovlari (Rate Restrictions) — bitta narx rejasi ostida,
// aniq bir sana uchun sotuv qoidalarini belgilaydi: Closed to Arrival/
// Departure, Min/Max Length of Stay, Stop Sell. RLS keyingi migratsiyada —
// `EnableRowLevelSecurityRatePlanRestrictions1787300100000`.
export class AddRatePlanRestrictions1787300000000 implements MigrationInterface {
  name = 'AddRatePlanRestrictions1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rate_plan_restrictions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rate_plan_id" uuid NOT NULL,
        "date" date NOT NULL,
        "closed_to_arrival" boolean NOT NULL DEFAULT false,
        "closed_to_departure" boolean NOT NULL DEFAULT false,
        "min_length_of_stay" integer,
        "max_length_of_stay" integer,
        "stop_sell" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_plan_restrictions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_rate_plan_restrictions_plan_date" ON "rate_plan_restrictions" ("rate_plan_id", "date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_restrictions" ADD CONSTRAINT "FK_rate_plan_restrictions_rate_plan_id" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rate_plan_restrictions" DROP CONSTRAINT "FK_rate_plan_restrictions_rate_plan_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rate_plan_restrictions_plan_date"`,
    );
    await queryRunner.query(`DROP TABLE "rate_plan_restrictions"`);
  }
}
