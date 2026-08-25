import { MigrationInterface, QueryRunner } from 'typeorm';

// Guruh/blok bron — korporativ mijoz yoki turizm agentligi bir vaqtning
// o'zida bir nechta xonani bitta "guruh" nomi ostida bron qiladi. Har bir
// xona hamon oddiy `bookings` yozuvi (check-in/check-out/folio mantig'i
// o'zgarmaydi), faqat yangi ixtiyoriy `group_id` ustuni orqali
// `booking_groups`ga bog'lanadi.
export class AddBookingGroups1786960000000 implements MigrationInterface {
  name = 'AddBookingGroups1786960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "booking_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "group_name" character varying(200) NOT NULL,
        "company_name" character varying(200),
        "contact_name" character varying(200),
        "contact_phone" character varying(50),
        "contact_email" character varying(200),
        "notes" character varying(1000),
        "created_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_groups_tenant_property" ON "booking_groups" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(`ALTER TABLE "bookings" ADD "group_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_group_id" FOREIGN KEY ("group_id") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_group_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "group_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_groups_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "booking_groups"`);
  }
}
