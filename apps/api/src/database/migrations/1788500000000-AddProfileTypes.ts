import { MigrationInterface, QueryRunner } from 'typeorm';

// Profil turlari (2026-09-04, OPERA Cloud "Manage Profile" referensi).
//
// `guests` jadvali endi faqat jismoniy mehmonlarni emas, KOMPANIYA, TURAGENT,
// MANBA, GURUH va KONTAKT profillarini ham saqlaydi. Alohida jadval ochilmadi:
// bronlar, hisob-fakturalar va POS buyurtmalari allaqachon `guest_id` orqali
// shu jadvalga bog'langan — ikkiga bo'lish har bir havolada "qaysi jadval?"
// degan savol tug'dirardi.
//
// XAVFSIZLIK: mavjud barcha qatorlar jismoniy mehmon edi, shuning uchun
// `profile_type` ustuni DEFAULT 'guest' bilan qo'shiladi va eski qatorlar
// avtomatik to'g'ri turni oladi — ma'lumot ko'chirish (backfill) talab
// qilinmaydi.
export class AddProfileTypes1788500000000 implements MigrationInterface {
  name = 'AddProfileTypes1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "guests_profile_type_enum" AS ENUM (
        'guest', 'company', 'travel_agent', 'source', 'group', 'contact'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "guests"
        ADD COLUMN "profile_type" "guests_profile_type_enum" NOT NULL DEFAULT 'guest',
        ADD COLUMN "tax_id" character varying(32),
        ADD COLUMN "address" character varying(255),
        ADD COLUMN "city" character varying(100),
        ADD COLUMN "contact_person" character varying(160),
        ADD COLUMN "commission_pct" numeric(5,2),
        ADD COLUMN "parent_profile_id" uuid
    `);

    // Kontakt profilining tashkiloti. SET NULL — tashkilot o'chirilsa kontakt
    // odam qolaveradi, faqat bog'lanish uziladi.
    await queryRunner.query(`
      ALTER TABLE "guests"
        ADD CONSTRAINT "FK_guests_parent_profile"
        FOREIGN KEY ("parent_profile_id") REFERENCES "guests"("id") ON DELETE SET NULL
    `);

    // Ro'yxat deyarli har doim tur bo'yicha filtrlanadi (GuestPicker faqat
    // 'guest' turini so'raydi, Profillar sahifasi esa tanlangan turni), shuning
    // uchun tenant bilan birgalikda kompozit indeks.
    await queryRunner.query(
      `CREATE INDEX "IDX_guests_tenant_profile_type" ON "guests" ("tenant_id", "profile_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guests_parent_profile" ON "guests" ("parent_profile_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_guests_parent_profile"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_guests_tenant_profile_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "FK_guests_parent_profile"`,
    );
    await queryRunner.query(`
      ALTER TABLE "guests"
        DROP COLUMN IF EXISTS "parent_profile_id",
        DROP COLUMN IF EXISTS "commission_pct",
        DROP COLUMN IF EXISTS "contact_person",
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "address",
        DROP COLUMN IF EXISTS "tax_id",
        DROP COLUMN IF EXISTS "profile_type"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "guests_profile_type_enum"`);
  }
}
