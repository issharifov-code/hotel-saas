import { MigrationInterface, QueryRunner } from 'typeorm';

// Bronning KONTAKT SHAXSI — tashkilot bron qilganda "kim bilan
// gaplashamiz" degan savolga javob (2026-09-05).
//
// Nima uchun `guests.contact_person` yetarli emas: u tashkilot profilidagi
// bir qatorlik ISM, ya'ni butun tashkilot uchun bitta va telefoni/emaili
// yo'q. Katta agentlikda esa har bron uchun boshqa menejer bo'ladi.
// CONTACT profil turi allaqachon mavjud edi (`parent_profile_id` orqali
// tashkilotga bog'lanadi), lekin bron oqimida umuman ishlatilmasdi — shu
// bo'shliq yopiladi.
//
// SET NULL: kontakt profili o'chirilsa bron qolib ketadi, faqat bog'lanish
// uziladi. Bron — moliyaviy hujjat, u odam ishdan bo'shagani uchun
// yo'qolmasligi kerak.
export class AddBookingContactProfile1789000000000
  implements MigrationInterface
{
  name = 'AddBookingContactProfile1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "contact_profile_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "FK_bookings_contact_profile"
      FOREIGN KEY ("contact_profile_id") REFERENCES "guests"("id") ON DELETE SET NULL
    `);
    // "Shu kontakt orqali qancha bron keldi" — agentlik menejerining
    // samaradorligi. Manba profilidagi indeks bilan bir xil shakl.
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_contact_profile"
      ON "bookings" ("tenant_id", "property_id", "contact_profile_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_contact_profile"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_contact_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "contact_profile_id"`,
    );
  }
}
