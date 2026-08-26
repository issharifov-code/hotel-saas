import { MigrationInterface, QueryRunner } from 'typeorm';

// Function Space / Events — mehmonxonaning banket zali/konferensiya xonasi
// va ularga qilingan tadbir bronlari. Mehmon yotoq xonalari (rooms/bookings)
// zanjiriga hech qanday tegishi yo'q — butunlay mustaqil, additive modul.
export class AddFunctionSpaces1786980000000 implements MigrationInterface {
  name = 'AddFunctionSpaces1786980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "function_spaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "capacity" integer NOT NULL,
        "daily_rate" numeric(12,2) NOT NULL DEFAULT 0,
        "description" character varying(1000),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_function_spaces" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_function_spaces_tenant_property" ON "function_spaces" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."function_space_bookings_status_enum" AS ENUM('tentative', 'confirmed', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "function_space_bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "function_space_id" uuid NOT NULL,
        "event_name" character varying(200) NOT NULL,
        "organizer_name" character varying(200) NOT NULL,
        "organizer_phone" character varying(50),
        "organizer_email" character varying(200),
        "start_time" TIMESTAMP NOT NULL,
        "end_time" TIMESTAMP NOT NULL,
        "attendee_count" integer,
        "setup_style" character varying(100),
        "status" "public"."function_space_bookings_status_enum" NOT NULL DEFAULT 'confirmed',
        "total_amount" numeric(12,2),
        "notes" character varying(1000),
        "created_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_function_space_bookings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_function_space_bookings_tenant_property" ON "function_space_bookings" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_function_space_bookings_space_time" ON "function_space_bookings" ("function_space_id", "start_time", "end_time")`,
    );
    await queryRunner.query(
      `ALTER TABLE "function_space_bookings" ADD CONSTRAINT "FK_function_space_bookings_function_space_id" FOREIGN KEY ("function_space_id") REFERENCES "function_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "function_space_bookings" DROP CONSTRAINT "FK_function_space_bookings_function_space_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_function_space_bookings_space_time"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_function_space_bookings_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "function_space_bookings"`);
    await queryRunner.query(
      `DROP TYPE "public"."function_space_bookings_status_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_function_spaces_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "function_spaces"`);
  }
}
