import { MigrationInterface, QueryRunner } from 'typeorm';

// Guest CRM preferences/duplicate-merge kengaytmasi (2026-08-17): mehmon
// profiliga strukturaviy afzalliklar (xona, parhez) va aloqa kanali
// afzalligi qo'shiladi. Duplicate-detection/merge o'zi mavjud ustunlarga
// (phone/email/document_number) tayanadi va yangi jadval/migratsiya talab
// qilmaydi — faqat GuestsService darajasida amalga oshiriladi.
export class AddGuestPreferences1786920000000 implements MigrationInterface {
  name = 'AddGuestPreferences1786920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."guests_communication_preference_enum" AS ENUM('email', 'sms', 'phone', 'none')`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "room_preference" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "dietary_preference" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "communication_preference" "public"."guests_communication_preference_enum" NOT NULL DEFAULT 'email'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "communication_preference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "dietary_preference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "room_preference"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."guests_communication_preference_enum"`,
    );
  }
}
