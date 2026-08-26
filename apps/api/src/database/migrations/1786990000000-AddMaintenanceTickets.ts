import { MigrationInterface, QueryRunner } from 'typeorm';

// Texnik xizmat so'rovlari (Maintenance / Work Orders) — xonadagi ta'mirlash
// talab qiladigan muammolarni (konditsioner, santexnika va h.k.) kuzatish.
// Housekeeping'ga o'xshash naqsh (room_id FK, status-based workflow), lekin
// mustaqil jadval — mehmon bron/folio zanjiriga tegishi yo'q, additive modul.
export class AddMaintenanceTickets1786990000000 implements MigrationInterface {
  name = 'AddMaintenanceTickets1786990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_tickets_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_tickets_status_enum" AS ENUM('open', 'in_progress', 'resolved', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "maintenance_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" character varying(1000),
        "priority" "public"."maintenance_tickets_priority_enum" NOT NULL DEFAULT 'medium',
        "status" "public"."maintenance_tickets_status_enum" NOT NULL DEFAULT 'open',
        "reported_by_user_id" uuid NOT NULL,
        "assigned_to_user_id" uuid,
        "resolution_notes" character varying(1000),
        "started_at" TIMESTAMP,
        "resolved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_maintenance_tickets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_maintenance_tickets_tenant_property" ON "maintenance_tickets" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "FK_maintenance_tickets_room_id" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "FK_maintenance_tickets_room_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_maintenance_tickets_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "maintenance_tickets"`);
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_tickets_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_tickets_priority_enum"`,
    );
  }
}
