import { MigrationInterface, QueryRunner } from 'typeorm';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M13). `demo_requests`
// ochiq (autentifikatsiyasiz) yo'ldan to'ladi, ya'ni jadval hajmini
// tashqi tomon belgilaydi. Takroriy murojaatlarni mazmun bo'yicha
// filtrlash uchun normallashtirilgan telefon ustuni qo'shiladi
// (izohlar: `marketing.service.ts`).
//
// Mavjud qatorlar ham to'ldiriladi — aks holda eski yozuvlar dedup'ga
// umuman qatnashmasdi. Normallashtirish mantig'i TypeScript'dagi
// `normalizePhone` bilan bir xil: faqat raqamlar, 12 xonali `998...`
// bo'lsa mamlakat kodi olib tashlanadi.
export class AddDemoRequestPhoneNormalized1789700000000 implements MigrationInterface {
  name = 'AddDemoRequestPhoneNormalized1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "demo_requests"
      ADD COLUMN IF NOT EXISTS "phone_normalized" character varying(50) NOT NULL DEFAULT ''
    `);

    await queryRunner.query(`
      UPDATE "demo_requests"
      SET "phone_normalized" = CASE
        WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 12
             AND regexp_replace("phone", '\\D', '', 'g') LIKE '998%'
          THEN substr(regexp_replace("phone", '\\D', '', 'g'), 4)
        WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 13
             AND regexp_replace("phone", '\\D', '', 'g') LIKE '0998%'
          THEN substr(regexp_replace("phone", '\\D', '', 'g'), 5)
        ELSE regexp_replace("phone", '\\D', '', 'g')
      END
      WHERE "phone_normalized" = ''
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_demo_requests_phone_normalized"
      ON "demo_requests" ("phone_normalized", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_demo_requests_phone_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "demo_requests" DROP COLUMN IF EXISTS "phone_normalized"`,
    );
  }
}
