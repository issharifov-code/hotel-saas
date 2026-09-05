import { MigrationInterface, QueryRunner } from 'typeorm';

// 🔴 XONA BRONIDAGI NUQSONNING AYNAN O'ZI — ZALLARDA (2026-09-05).
//
// `PreventOverlappingBookings` (1790000000000) bilan bir kunda topildi.
// Sabab: bir joyda topilgan naqsh odatda yolg'iz bo'lmaydi, shuning
// uchun "avval SELECT, keyin INSERT" ko'rinishidagi barcha joylar
// ko'zdan kechirildi.
//
// TEKSHIRILGAN NOMZODLAR:
//   * ombor qoldig'i (`stock.service.ts`) — HIMOYALANGAN,
//     `setLock('pessimistic_write')` ishlatadi;
//   * `tenants.subdomain` — HIMOYALANGAN, UNIQUE indeks bor;
//   * zal bandligi (`FunctionSpacesService.assertSpaceAvailable`) —
//     OCHIQ edi, hech qanday baza cheklovi yo'q (jadvalda faqat PK va FK).
//
// SINALDI: bir vaqtda yuborilgan, qisman ustma-ust tushadigan ikkita
// tadbir (10:00—14:00 va 13:00—17:00) IKKALASI HAM yozildi
// (`test/integration/function-space-concurrency.int-spec.ts`).
//
// NIMA UCHUN QIMMAT. To'y, konferensiya yoki banket zali — mehmonxona
// uchun bitta xonadan ko'ra ko'proq pul. Ikki tadbir bir vaqtga tushib
// qolsa, birini bekor qilish kerak bo'ladi, va bu ko'pincha mijoz
// allaqachon taklifnoma tarqatganidan keyin ma'lum bo'ladi.
//
// YECHIM — xona bronidagi bilan bir xil: `EXCLUDE USING gist`. Farqi
// faqat tipda: bu yerda sana emas, vaqt oralig'i
// (`timestamp without time zone` → `tsrange`).
//
// `[)` — o'ng chegara kiritilmaydi: 09:00—12:00 va 12:00—15:00
// TO'QNASHMAYDI. Zalni kun davomida ikki marta ishlatish odatiy hol va
// uni taqiqlash noto'g'ri bo'lardi. Bu kod darajasidagi mantiq bilan
// ham bir xil (`start_time < :endTime AND end_time > :startTime`).
//
// `WHERE status <> 'cancelled'` — bekor qilingan tadbir bandlik
// hisoblanmaydi. Bu `assertSpaceAvailable` dagi shart bilan BIR XIL
// bo'lishi shart. Diqqat: xona bronidan farqli o'laroq bu yerda
// "oq ro'yxat" emas, "qora ro'yxat" ishlatiladi — chunki
// `tentative` (dastlabki band) ham zalni band qiladi.
export class PreventOverlappingFunctionSpaceBookings1790100000000
  implements MigrationInterface
{
  name = 'PreventOverlappingFunctionSpaceBookings1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

    // Mavjud ma'lumotni avval tekshiramiz — sabab va naqsh
    // `PreventOverlappingBookings` dagi bilan bir xil: cheklov
    // qo'shilmasa tushunarsiz xato chiqardi va operator nima
    // qilishni bilmasdi.
    const overlaps: { a: string; b: string; space: string; range: string }[] =
      await queryRunner.query(`
        SELECT b1."id" AS a, b2."id" AS b, b1."function_space_id" AS space,
               (b1."start_time" || ' — ' || b1."end_time") AS range
        FROM "function_space_bookings" b1
        JOIN "function_space_bookings" b2
          ON b1."function_space_id" = b2."function_space_id"
         AND b1."id" < b2."id"
         AND b1."start_time" < b2."end_time"
         AND b1."end_time" > b2."start_time"
        WHERE b1."status" <> 'cancelled'
          AND b2."status" <> 'cancelled'
        LIMIT 20
      `);

    if (overlaps.length > 0) {
      const list = overlaps
        .map((o) => `  zal ${o.space}: ${o.a} va ${o.b} (${o.range})`)
        .join('\n');
      throw new Error(
        `Bazada allaqachon ustma-ust tushgan zal bronlari bor (${overlaps.length} ta juftlik topildi) — ` +
          "cheklov qo'shishdan oldin ular hal qilinishi kerak (birini bekor qiling yoki vaqtini o'zgartiring):\n" +
          list,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "function_space_bookings"
      ADD CONSTRAINT "function_space_bookings_no_overlap"
      EXCLUDE USING gist (
        "function_space_id" WITH =,
        tsrange("start_time", "end_time", '[)') WITH &&
      )
      WHERE ("status" <> 'cancelled')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "function_space_bookings" DROP CONSTRAINT IF EXISTS "function_space_bookings_no_overlap"',
    );
  }
}
