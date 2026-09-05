import { MigrationInterface, QueryRunner } from 'typeorm';

// 🔴 SODIQLIK BALLARI: OXIRGI HIMOYA CHIZIG'I (2026-09-05).
//
// Integratsion testda "yo'qolgan yangilanish" (lost update) topildi:
// `LoyaltyService.applyPointsChange` qatorni qulfsiz o'qib, mutlaq
// qiymat yozardi. Bir vaqtda kelgan ikki so'rov bir xil boshlang'ich
// qiymatni ko'rib, ikkinchisi birinchisini bosib ketardi.
//
// Oqibati og'ir edi: qoldiq 100 bo'lganda bir vaqtda yuborilgan
// beshta "−80" so'rovidan TO'RTTASI o'tib ketdi — mehmonxona 320 ball
// qiymatini berib, atigi 80 ni ayirdi.
//
// Asosiy yechim — qator qulfi (`pessimistic_write`), u xizmat
// qatlamida. Bu migratsiya esa IKKINCHI qatlam: agar kelajakda biror
// yangi yo'l qulfni chetlab o'tsa (masalan to'g'ridan-to'g'ri
// `guestRepo.save()` yoki qo'lda SQL), manfiy qoldiq BAZAGA
// YOZILMAYDI.
//
// NEGA BU CHEKLOV POYGANI O'ZI HAL QILMAYDI. `CHECK` faqat manfiy
// qiymatni to'sadi. "Bir vaqtda ikki marta +10 yuborildi, qoldiq esa
// 20 emas 10 bo'ldi" holatini u ko'rmaydi — u yerda qiymat musbat,
// shunchaki NOTO'G'RI. Shuning uchun qulf ham, cheklov ham kerak:
// biri to'g'riligini, ikkinchisi xavfsizligini ta'minlaydi.
//
// `lifetime_points` ham tekshiriladi: u faqat o'sadi, ya'ni manfiy
// bo'lishi mantiqan mumkin emas va bunday qiymat nuqsondan darak
// beradi.
export class LoyaltyPointsNonNegative1790200000000
  implements MigrationInterface
{
  name = 'LoyaltyPointsNonNegative1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mavjud manfiy qiymatlarni avval tekshiramiz — cheklov qo'shib
    // bo'lmasa migratsiya tushunarsiz xato bilan yiqilardi.
    const bad: { id: string; points: number; lifetime: number }[] =
      await queryRunner.query(`
        SELECT "id", "loyalty_points" AS points, "lifetime_points" AS lifetime
        FROM "guests"
        WHERE "loyalty_points" < 0 OR "lifetime_points" < 0
        LIMIT 20
      `);

    if (bad.length > 0) {
      const list = bad
        .map((g) => `  mehmon ${g.id}: ball ${g.points}, umrbod ${g.lifetime}`)
        .join('\n');
      throw new Error(
        `Bazada manfiy sodiqlik balli bo'lgan mehmonlar bor (${bad.length} ta) — ` +
          "cheklov qo'shishdan oldin ular to'g'rilanishi kerak:\n" +
          list,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "guests"
      ADD CONSTRAINT "guests_loyalty_points_non_negative"
      CHECK ("loyalty_points" >= 0 AND "lifetime_points" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_loyalty_points_non_negative"',
    );
  }
}
