import { MigrationInterface, QueryRunner } from 'typeorm';

// USALI hisoblar rejasidagi "2300 — Xodimlarga to'lanadigan ish haqi"
// (Liability) va "6109 — Payroll-Related Expenses" (Expense, Admin & General)
// hisoblari allaqachon barcha tenant'lar uchun seed qilingan, lekin
// `system_key`si NULL edi (dasturiy jihatdan ishlatib bo'lmas edi — 3-bo'limda
// hujjatlashtirilgan `DemoRequest` xatosi bilan bir xil sinf emas, shunchaki
// hali hech qanday modul bu hisoblarga murojaat qilmagan edi). Bu migratsiya
// MAVJUD tenant'larning shu ikkita hisobiga `system_key` orqaga (backfill)
// yozadi — shunda `AccountingService.getAccountBySystemKey('payroll_expense'
// | 'payroll_liability')` orqali topiladi. Yangi tenant'lar uchun bu key'lar
// endi seed vaqtida to'g'ridan-to'g'ri beriladi (default-chart-of-accounts.ts
// yangilanishi orqali).
export class BackfillPayrollSystemKeys1787800100000 implements MigrationInterface {
  name = 'BackfillPayrollSystemKeys1787800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = 'payroll_liability' WHERE "code" = '2300' AND "system_key" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = 'payroll_expense' WHERE "code" = '6109' AND "system_key" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = NULL WHERE "code" = '6109' AND "system_key" = 'payroll_expense'`,
    );
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = NULL WHERE "code" = '2300' AND "system_key" = 'payroll_liability'`,
    );
  }
}
