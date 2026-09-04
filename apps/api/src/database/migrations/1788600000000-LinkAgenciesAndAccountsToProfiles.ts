import { MigrationInterface, QueryRunner } from 'typeorm';

// Agentlik va korporativ hisobni PROFILGA bog'lash (2026-09-04, foydalanuvchi
// qarori: "Profil = shaxs, Agency/Corporate = pul").
//
// MUAMMO: shu kuni ertalab `guests` jadvaliga `travel_agent` va `company`
// profil turlari qo'shildi — lekin loyihada allaqachon `agencies` (turagent,
// komissiya bilan) va `corporate_accounts` (to'lovchi kompaniya, kredit
// limiti bilan) bor edi. Ya'ni "Silk Road Tours"ni mehmonxona ikki marta
// kiritishi kerak bo'lardi.
//
// YECHIM: kim ekanini (nom, STIR, manzil, aloqa) PROFIL saqlaydi;
// `agencies`/`corporate_accounts` esa faqat MOLIYAVIY sozlamani (komissiya
// foizi, kredit limiti) va profilga havolani. Shu bilan:
//   - identifikatsiya bitta joyda,
//   - mavjud hisobotlar va City Ledger buzilmaydi (ular hamon agency/account
//     orqali ishlaydi),
//   - profil TENANT darajasida, agency/account esa MULK darajasida qoladi —
//     ya'ni bitta agentlikning har mulkda o'z komissiyasi bo'lishi mumkin.
//
// MA'LUMOT XAVFSIZLIGI: eski ustunlar (`name`, `contact_*`, `tax_id`,
// `billing_address`) O'CHIRILMAYDI. Ular tarixiy yozuv sifatida qoladi, faqat
// endi o'qilmaydi. Shu sababdan bu migratsiyani ortga qaytarish ham
// ma'lumotsiz qolmaydi.
export class LinkAgenciesAndAccountsToProfiles1788600000000
  implements MigrationInterface
{
  name = 'LinkAgenciesAndAccountsToProfiles1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Profil ustunlarini manba ustunlar SIG'ADIGAN qilib kengaytiramiz.
    //    Aks holda ko'chirishda qiymat kesilib qolardi (masalan
    //    `agencies.contact_phone` 50, `guests.phone` esa 30 belgi edi).
    await queryRunner.query(`
      ALTER TABLE "guests"
        ALTER COLUMN "phone" TYPE character varying(50),
        ALTER COLUMN "tax_id" TYPE character varying(50),
        ALTER COLUMN "address" TYPE character varying(1000),
        ALTER COLUMN "contact_person" TYPE character varying(200)
    `);

    // 2) Komissiya foizi profildan OLIB TASHLANADI. U mulkka bog'liq pul
    //    sozlamasi — o'rni `agencies.commission_pct`. Profilda ham qoldirsak,
    //    aynan biz tuzatayotgan takrorlanishni qayta yaratgan bo'lardik.
    //    Ustun bugun qo'shilgan va hech qayerda ishlatilmagan.
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN IF EXISTS "commission_pct"`,
    );

    // 3) Havola ustunlari.
    await queryRunner.query(
      `ALTER TABLE "agencies" ADD COLUMN "profile_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" ADD COLUMN "profile_id" uuid`,
    );

    // 4) Mavjud yozuvlar uchun profil yaratamiz.
    //    Tartib muhim: avval ID'ni O'ZIMIZ tanlaymiz, keyin shu ID bilan
    //    profil qo'shamiz. Aks holda `INSERT ... RETURNING` natijasini qaysi
    //    agentlikka tegishli ekanini nom bo'yicha topishga to'g'ri kelardi —
    //    bir xil nomli ikkita yozuv bo'lsa esa xato bo'lardi.
    await queryRunner.query(
      `UPDATE "agencies" SET "profile_id" = uuid_generate_v4() WHERE "profile_id" IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO "guests" ("id", "tenant_id", "profile_type", "full_name", "phone", "email", "contact_person")
      SELECT a."profile_id", a."tenant_id", 'travel_agent', a."name",
             a."contact_phone", a."contact_email", a."contact_name"
      FROM "agencies" a
    `);

    await queryRunner.query(
      `UPDATE "corporate_accounts" SET "profile_id" = uuid_generate_v4() WHERE "profile_id" IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO "guests" ("id", "tenant_id", "profile_type", "full_name", "phone", "email", "contact_person", "tax_id", "address")
      SELECT c."profile_id", c."tenant_id", 'company', c."name",
             c."contact_phone", c."contact_email", c."contact_name",
             c."tax_id", c."billing_address"
      FROM "corporate_accounts" c
    `);

    // 5) Endi hamma qator to'ldirilgan — NOT NULL va FK qo'yamiz.
    //    RESTRICT: profil o'chirilsa agentlik nomsiz qolib ketmasin. Amalda
    //    profil faqat birlashtirish (merge) paytida o'chadi, va u yerda
    //    havolalar oldindan ko'chiriladi (GuestsService.mergeGuests).
    await queryRunner.query(
      `ALTER TABLE "agencies" ALTER COLUMN "profile_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "agencies"
        ADD CONSTRAINT "FK_agencies_profile"
        FOREIGN KEY ("profile_id") REFERENCES "guests"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agencies_profile" ON "agencies" ("profile_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" ALTER COLUMN "profile_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "corporate_accounts"
        ADD CONSTRAINT "FK_corporate_accounts_profile"
        FOREIGN KEY ("profile_id") REFERENCES "guests"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_corporate_accounts_profile" ON "corporate_accounts" ("profile_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 🔴 TARTIB MUHIM. Ko'chirishda yaratilgan profillarni ham olib tashlash
    // kerak (aks holda qayta `up` qilinganda ular ikki marta paydo bo'lardi),
    // LEKIN ularni FK hali turganda o'chirib bo'lmaydi — RESTRICT to'sadi.
    // Shuning uchun: avval ro'yxatni vaqtinchalik jadvalga olamiz, keyin FK
    // va ustunlarni olib tashlaymiz, va faqat oxirida profillarni o'chiramiz.
    // (Birinchi urinishda aynan shu tartib buzilgan edi va `down` FK xatosi
    // bilan yiqilgan — ma'lumot bilan sinab ko'rilganda aniqlandi.)
    await queryRunner.query(`
      CREATE TEMP TABLE "_profillar_ochiriladi" AS
        SELECT "profile_id" AS "id" FROM "agencies" WHERE "profile_id" IS NOT NULL
        UNION
        SELECT "profile_id" FROM "corporate_accounts" WHERE "profile_id" IS NOT NULL
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_corporate_accounts_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" DROP CONSTRAINT IF EXISTS "FK_corporate_accounts_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "corporate_accounts" DROP COLUMN IF EXISTS "profile_id"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agencies_profile"`);
    await queryRunner.query(
      `ALTER TABLE "agencies" DROP CONSTRAINT IF EXISTS "FK_agencies_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agencies" DROP COLUMN IF EXISTS "profile_id"`,
    );

    // Endi FK yo'q — profillarni o'chirsak bo'ladi.
    await queryRunner.query(
      `DELETE FROM "guests" WHERE "id" IN (SELECT "id" FROM "_profillar_ochiriladi")`,
    );
    await queryRunner.query(`DROP TABLE "_profillar_ochiriladi"`);

    await queryRunner.query(
      `ALTER TABLE "guests" ADD COLUMN "commission_pct" numeric(5,2)`,
    );
    await queryRunner.query(`
      ALTER TABLE "guests"
        ALTER COLUMN "phone" TYPE character varying(30),
        ALTER COLUMN "tax_id" TYPE character varying(32),
        ALTER COLUMN "address" TYPE character varying(255),
        ALTER COLUMN "contact_person" TYPE character varying(160)
    `);
  }
}
