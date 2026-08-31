import { MigrationInterface, QueryRunner } from 'typeorm';

// Mehmonlarga xabar yuborish (email/SMS, mock provayder orqali, Payments
// modulidagi adapter naqshiga o'xshab) — Guest.communicationPreference
// maydonini ("hozircha faqat saqlanadi" deb izohlangan edi) endi haqiqatan
// iste'mol qiluvchi birinchi modul. Mustaqil, additive jadvallar — mehmon
// bron/folio/check-in/check-out zanjiriga hech qanday o'zgartirish kirmaydi.
export class AddMessaging1787000000000 implements MigrationInterface {
  name = 'AddMessaging1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."message_templates_trigger_type_enum" AS ENUM('booking_confirmed', 'checked_in', 'checked_out', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_templates_channel_enum" AS ENUM('email', 'sms')`,
    );
    await queryRunner.query(`
      CREATE TABLE "message_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "trigger_type" "public"."message_templates_trigger_type_enum" NOT NULL DEFAULT 'custom',
        "channel" "public"."message_templates_channel_enum" NOT NULL,
        "subject" character varying(200),
        "body_template" character varying(4000) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_message_templates_tenant_property" ON "message_templates" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."message_logs_channel_enum" AS ENUM('email', 'sms')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_logs_status_enum" AS ENUM('sent', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "message_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "booking_id" uuid,
        "template_id" uuid,
        "channel" "public"."message_logs_channel_enum" NOT NULL,
        "subject" character varying(200),
        "body" character varying(4000) NOT NULL,
        "status" "public"."message_logs_status_enum" NOT NULL,
        "provider" character varying(50),
        "provider_ref" character varying(200),
        "failure_reason" character varying(500),
        "sent_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_message_logs_tenant_property" ON "message_logs" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_logs_guest_id" ON "message_logs" ("guest_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD CONSTRAINT "FK_message_logs_guest_id" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD CONSTRAINT "FK_message_logs_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD CONSTRAINT "FK_message_logs_template_id" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_template_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_booking_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP CONSTRAINT "FK_message_logs_guest_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_message_logs_guest_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_message_logs_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "message_logs"`);
    await queryRunner.query(`DROP TYPE "public"."message_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."message_logs_channel_enum"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_message_templates_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "message_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."message_templates_channel_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."message_templates_trigger_type_enum"`,
    );
  }
}
