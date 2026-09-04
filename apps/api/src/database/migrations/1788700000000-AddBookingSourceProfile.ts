import { MigrationInterface, QueryRunner } from 'typeorm';

// Bronni MANBA profiliga bog'lash (2026-09-04).
//
// `bookings.source` allaqachon bor, lekin u KANAL (direct / website / ota /
// exely) — ya'ni "texnik jihatdan qayerdan tushdi". Manba profili esa
// NOMLANGAN manba: "Instagram reklamasi", "Hamkor restoran", "Konferensiya
// tashkilotchisi". Ikkalasi bir-birini almashtirmaydi: bron sayt orqali
// tushib, manbasi "Instagram reklamasi" bo'lishi mumkin.
//
// SET NULL — manba profili o'chirilsa bron yo'qolmasin, faqat bog'lanish
// uzilsin (agentlik/korporativ hisobdagi naqsh bilan bir xil).
export class AddBookingSourceProfile1788700000000 implements MigrationInterface {
  name = 'AddBookingSourceProfile1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "source_profile_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "FK_bookings_source_profile"
        FOREIGN KEY ("source_profile_id") REFERENCES "guests"("id") ON DELETE SET NULL
    `);
    // Hisobotlar "qaysi manba qancha daromad keltirdi" deb guruhlaydi —
    // tenant+mulk bilan birgalikda indeks.
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_source_profile" ON "bookings" ("tenant_id", "property_id", "source_profile_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_source_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_source_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "source_profile_id"`,
    );
  }
}
