import { MigrationInterface, QueryRunner } from 'typeorm';

// Bron / Xona boshqaruvi kengaytmasi: "Narx rejasi" (Rate Plan) tushunchasi —
// bitta xona turi ostida bir nechta narx variantini (Rack Rate, Korporativ,
// Online, Qaytarilmaydigan va h.k.) belgilash imkonini beradi. `bookings`
// jadvaliga ixtiyoriy `rate_plan_id` (tanlangan reja) va majburiy
// `market_segment` (bozor segmenti — hisobot uchun) ustunlari qo'shiladi.
// RLS keyingi migratsiyada — `EnableRowLevelSecurityRatePlans1786900100000`.
export class AddRatePlans1786900000000 implements MigrationInterface {
  name = 'AddRatePlans1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rate_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "nightly_price" numeric(12,2) NOT NULL,
        "is_refundable" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "description" character varying(1000),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_plans_tenant_property" ON "rate_plans" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD CONSTRAINT "FK_rate_plans_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD CONSTRAINT "FK_rate_plans_room_type_id" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."bookings_market_segment_enum" AS ENUM('walk_in', 'corporate', 'ota', 'travel_agent', 'group', 'government', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "market_segment" "public"."bookings_market_segment_enum" NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" ADD "rate_plan_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_rate_plan_id" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_rate_plan_id"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "rate_plan_id"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "market_segment"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_market_segment_enum"`);

    await queryRunner.query(`ALTER TABLE "rate_plans" DROP CONSTRAINT "FK_rate_plans_room_type_id"`);
    await queryRunner.query(`ALTER TABLE "rate_plans" DROP CONSTRAINT "FK_rate_plans_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rate_plans_tenant_property"`);
    await queryRunner.query(`DROP TABLE "rate_plans"`);
  }
}
