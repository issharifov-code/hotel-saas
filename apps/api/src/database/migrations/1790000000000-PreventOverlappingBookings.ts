import { MigrationInterface, QueryRunner } from 'typeorm';

// 🔴 INTEGRATSION TESTDA TOPILGAN NUQSON — IKKI KARRA BRON (2026-09-05).
//
// MUAMMO. Xona bandligini tekshirish IKKI BOSQICHDAN iborat edi va
// ikkalasi orasida himoya yo'q edi:
//
//     1. SELECT — bu xonada shu sanaga bron bormi?
//     2. INSERT — yo'q ekan, yozamiz.
//
// Ikki so'rov bir vaqtda kelsa (ikki xodim, yoki sayt va Front Desk),
// ikkalasi ham 1-bosqichda "bo'sh" deb ko'radi — chunki hech biri
// ikkinchisining hali kommit qilinmagan yozuvini ko'rmaydi (READ
// COMMITTED izolyatsiyasi) — va ikkalasi ham yozadi.
//
// Bu ATAYLAB SINALDI: bir vaqtda 5 ta bir xil so'rov yuborilganda
// 2 tasi muvaffaqiyatli bo'ldi va bazada 2 ta qator paydo bo'ldi
// (`test/integration/concurrency.int-spec.ts`).
//
// NIMA UCHUN BU JIDDIY. Ikki karra bron — mehmonxonadagi eng qimmat
// xatolardan biri: kelgan mehmonga xona yo'qligini aytish kerak
// bo'ladi, ko'pincha tunda. Bu pul va obro' masalasi, va uni faqat
// mehmon kelganda bilib olinadi.
//
// NEGA KOD DARAJASIDAGI QULF (SELECT ... FOR UPDATE) YETARLI EMAS.
// U faqat qulfni OLADIGAN yo'llarni himoya qiladi. Bron esa bir
// nechta yo'ldan yaratiladi (Front Desk, sayt, guruh broni, xona
// almashtirish, sanalarni o'zgartirish) va kelajakda yangisi
// qo'shilishi mumkin. Bittasida qulf unutilsa — himoya jimgina
// yo'qoladi. Baza cheklovi esa YO'LDAN QAT'I NAZAR ishlaydi.
//
// Bu repozitoriyning umumiy falsafasiga ham mos: tenant izolyatsiyasi
// ham kodga emas, bazadagi RLS siyosatlariga tayanadi.
//
// QANDAY ISHLAYDI. `EXCLUDE USING gist` — PostgreSQL'ning aynan shu
// vazifa uchun mo'ljallangan cheklovi: "shu ikki shart bir vaqtda
// bajariladigan ikkita qator bo'lmasin".
//   * `room_id WITH =`             — bir xil xona;
//   * `daterange(...) WITH &&`     — sana oraliqlari kesishadi.
// `[)` — chap chegara kiritiladi, o'ng chegara kiritilmaydi: 1—3 va
// 3—5 bronlar TO'QNASHMAYDI (mehmon chiqadigan kuni yangisi kiradi).
// Bu kod darajasidagi mantiq bilan bir xil (`check_in < :checkOut AND
// check_out > :checkIn`).
//
// `WHERE (status IN (...))` — bekor qilingan, chiqib ketgan va
// kelmagan bronlar bandlik hisoblanmaydi, ya'ni ular ustiga yangi
// bron tushishi mumkin. Bu ro'yxat `BookingsService.BLOCKING_STATUSES`
// bilan BIR XIL bo'lishi shart.
//
// `btree_gist` kengaytmasi kerak: `=` operatori (uuid uchun) gist
// indeksida standart holda qo'llab-quvvatlanmaydi. U PostgreSQL'ning
// standart contrib to'plamida bor (`uuid-ossp` kabi).
export class PreventOverlappingBookings1790000000000
  implements MigrationInterface
{
  name = 'PreventOverlappingBookings1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

    // 🔴 AVVAL MAVJUD MA'LUMOTNI TEKSHIRAMIZ. Nuqson uzoq vaqt ochiq
    // turgan bo'lsa, bazada allaqachon ustma-ust bronlar bo'lishi
    // mumkin. Unda cheklov qo'shib bo'lmaydi va migratsiya tushunarsiz
    // xato bilan yiqilardi ("conflicting key value violates exclusion
    // constraint"), operator esa nima qilishni bilmasdi.
    //
    // Shuning uchun avval o'zimiz topamiz va ANIQ xabar beramiz:
    // qaysi bronlar, qaysi xonada, qaysi sanalarda.
    const overlaps: { a: string; b: string; room: string; range: string }[] =
      await queryRunner.query(`
        SELECT b1."id" AS a, b2."id" AS b, b1."room_id" AS room,
               (b1."check_in" || '—' || b1."check_out") AS range
        FROM "bookings" b1
        JOIN "bookings" b2
          ON b1."room_id" = b2."room_id"
         AND b1."id" < b2."id"
         AND b1."check_in" < b2."check_out"
         AND b1."check_out" > b2."check_in"
        WHERE b1."status" IN ('pending','confirmed','checked_in')
          AND b2."status" IN ('pending','confirmed','checked_in')
        LIMIT 20
      `);

    if (overlaps.length > 0) {
      const list = overlaps
        .map((o) => `  xona ${o.room}: ${o.a} va ${o.b} (${o.range})`)
        .join('\n');
      throw new Error(
        `Bazada allaqachon ustma-ust tushgan bronlar bor (${overlaps.length} ta juftlik topildi) — ` +
          'cheklov qo\'shishdan oldin ular hal qilinishi kerak (birini bekor qiling yoki sanasini o\'zgartiring):\n' +
          list,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_no_overlap"
      EXCLUDE USING gist (
        "room_id" WITH =,
        daterange("check_in", "check_out", '[)') WITH &&
      )
      WHERE ("status" IN ('pending','confirmed','checked_in'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap"',
    );
    // `btree_gist` ATAYLAB o'chirilmaydi — boshqa narsa unga tayanib
    // qolgan bo'lishi mumkin, va kengaytmaning o'zi zararsiz.
  }
}
