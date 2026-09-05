import { MigrationInterface, QueryRunner } from 'typeorm';

// Ombor qoldig'i bosh kitobdagi 1200 "Ombor zaxiralari" hisobi bilan aynan
// tenglashishi uchun (2026-09-05, kod auditi topilmasi).
//
// Muammo: `unit_cost` 4 xonali (numeric(14,4)), provodkalar esa 2 xonali.
// Kirimda `inventory` BIR MARTA yaxlitlangan summa bilan debetlanadi, chiqim
// esa har safar ALOHIDA yaxlitlanadi. 7 dona × 12 345,6789:
//
//   kirim  : 86 419,7523 -> 86 419,75 debet
//   chiqim : 7 marta 12 345,6789 -> 12 345,68 = 86 419,76 kredit
//
// Partiya butunlay tugagan bo'lsa ham bosh kitobda −0,01 qolib ketardi.
// Summa jihatidan bu arzimas, lekin ombor hisoboti bilan bosh kitobni
// solishtirish (reconciliation) avtomatik tenglashmaydi — buxgalter har
// oy shu bir tiyinni qidiradi.
//
// Yechim: har bir partiya BOSH KITOBGA HAQIQATAN yozilgan qiymatini
// (`booked_cost_remaining`) o'zi bilan olib yuradi. Chiqimda partiya
// to'liq tugasa, uning qoldig'i AYNAN shu qiymat bilan kreditlanadi —
// ya'ni yaxlitlash farqi oxirgi bo'lakda o'z-o'zidan yopiladi.
//
// Mavjud partiyalar uchun qiymat qoldiqdan hisoblab qo'yiladi: bu o'tmishdagi
// farqni tuzatmaydi (uni tuzatish uchun tarixiy provodkalarni qayta yozish
// kerak bo'lardi), lekin BUNDAN KEYIN yangi farq to'planmaydi.
export class AddStockLotBookedCost1789200000000 implements MigrationInterface {
  name = 'AddStockLotBookedCost1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_lots" ADD "booked_cost_remaining" numeric(14,2)`,
    );
    await queryRunner.query(`
      UPDATE "stock_lots"
      SET "booked_cost_remaining" = ROUND("quantity_remaining" * "unit_cost", 2)
    `);
    await queryRunner.query(
      `ALTER TABLE "stock_lots" ALTER COLUMN "booked_cost_remaining" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_lots" ALTER COLUMN "booked_cost_remaining" SET DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_lots" DROP COLUMN IF EXISTS "booked_cost_remaining"`,
    );
  }
}
