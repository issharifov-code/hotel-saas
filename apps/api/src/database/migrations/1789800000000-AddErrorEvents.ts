import { MigrationInterface, QueryRunner } from 'typeorm';

// 📊 KUZATUV (2026-09-05). `error_events` — production'dagi 5xx
// xatolarning saqlanadigan izi. Sabab va dizayn qarorlari entity
// izohida (`common/observability/entities/error-event.entity.ts`).
//
// XAVFSIZLIK ESLATMASI. `EnableRowLevelSecurityBilling` (1789600000000)
// `ALTER DEFAULT PRIVILEGES` ni bekor qilgan, ya'ni yangi jadval
// avtomatik DML huquqi OLMAYDI. Shuning uchun bu yerda huquq aniq
// beriladi — va ataylab TOR: ilova roli INSERT, SELECT va DELETE oladi,
// UPDATE esa umuman berilmaydi. Yozilgan xato o'zgartirilmasligi kerak
// (aks holda uni keltirib chiqargan tomon o'z izini "tuzatib" qo'ya
// olardi).
//
// DELETE nima uchun kerak: jadval cheksiz o'sa olmaydi — 256MB'lik
// bazada xato sikli diskni to'ldirib qo'yishi mumkin. Lekin DELETE
// huquqi RLS siyosati bilan ESKI yozuvlar bilan cheklangan
// (`occurred_at < now() - 30 kun`), ya'ni yaqin kunlardagi dalilni
// o'chirib bo'lmaydi.
const APP_ROLE = 'hotel_saas_app';

// Saqlash muddati. Bundan eskisi tozalanishi mumkin — kesim RLS
// siyosatida, ya'ni ilova kodidagi xato ham undan o'tib keta olmaydi.
const RETENTION_DAYS = 30;

export class AddErrorEvents1789800000000 implements MigrationInterface {
  name = 'AddErrorEvents1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "error_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_id" character varying(64) NOT NULL,
        "status_code" integer NOT NULL,
        "method" character varying(10) NOT NULL,
        "path" character varying(500) NOT NULL,
        "tenant_id" uuid,
        "user_id" uuid,
        "name" character varying(200) NOT NULL,
        "message" text NOT NULL,
        "stack" text,
        "fingerprint" character varying(64) NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_error_events" PRIMARY KEY ("id")
      )
    `);

    // Ro'yxat har doim vaqt bo'yicha kamayish tartibida o'qiladi.
    await queryRunner.query(`
      CREATE INDEX "IDX_error_events_occurred_at"
      ON "error_events" ("occurred_at" DESC)
    `);
    // Guruhlash ("bu xato necha marta bo'lgan?") va bitta so'rov izini
    // topish uchun.
    await queryRunner.query(`
      CREATE INDEX "IDX_error_events_fingerprint"
      ON "error_events" ("fingerprint", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_error_events_request_id"
      ON "error_events" ("request_id")
    `);

    // Huquq: yozish, o'qish va (faqat eski yozuvlarni) o'chirish.
    // UPDATE ataylab berilmaydi.
    await queryRunner.query(
      `GRANT INSERT, SELECT, DELETE ON "error_events" TO "${APP_ROLE}"`,
    );

    // RLS: o'qish uchun ANIQ nomlangan bypass shart, yozish esa har doim
    // mumkin. Bu — `subscription_invoices` dagi `app.billing_bypass`
    // naqshining o'zi, faqat bu yerda tenant filtri o'rniga "faqat
    // platforma admini" ma'nosida.
    await queryRunner.query(
      `ALTER TABLE "error_events" ENABLE ROW LEVEL SECURITY`,
    );
    // Yozish: xato yozuvini saqlash hech qachon ma'lumot sizishi emas,
    // va u tenant konteksti O'RNATILMAGAN holatda ham (autentifikatsiyasiz
    // so'rovdagi xato) ishlashi shart.
    await queryRunner.query(`
      CREATE POLICY "error_events_insert" ON "error_events"
      FOR INSERT WITH CHECK (true)
    `);
    // O'qish: faqat bypass yoqilganda.
    await queryRunner.query(`
      CREATE POLICY "error_events_select" ON "error_events"
      FOR SELECT
      USING (current_setting('app.error_log_bypass', true) = 'on')
    `);
    // O'chirish: faqat saqlash muddatidan eski yozuvlar. Ilova kodida
    // xato bo'lsa ham (masalan noto'g'ri `WHERE`), yaqin kunlardagi
    // dalil o'chib ketmaydi — kesim bazaning o'zida.
    await queryRunner.query(`
      CREATE POLICY "error_events_delete_old" ON "error_events"
      FOR DELETE
      USING (occurred_at < now() - interval '${RETENTION_DAYS} days')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "error_events_delete_old" ON "error_events"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "error_events_select" ON "error_events"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "error_events_insert" ON "error_events"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "error_events"`);
  }
}
