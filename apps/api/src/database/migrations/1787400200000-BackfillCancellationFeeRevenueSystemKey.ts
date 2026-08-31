import { MigrationInterface, QueryRunner } from 'typeorm';

// USALI hisoblar rejasidagi "4901 — Cancellation Fees" hisobi (Revenue,
// Miscellaneous Income) allaqachon barcha tenant'lar uchun seed qilingan,
// lekin `system_key`si NULL edi (dasturiy jihatdan ishlatib bo'lmas edi).
// Bu migratsiya MAVJUD tenant'larning ushbu hisobiga `system_key`
// ('cancellation_fee_revenue') orqaga (backfill) yozadi — shunda
// AccountingService.getAccountBySystemKey('cancellation_fee_revenue') orqali
// topiladi. Yangi tenant'lar uchun bu key endi seed vaqtida to'g'ridan-to'g'ri
// beriladi (default-chart-of-accounts.ts'dagi yangilanish orqali).
export class BackfillCancellationFeeRevenueSystemKey1787400200000 implements MigrationInterface {
  name = 'BackfillCancellationFeeRevenueSystemKey1787400200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = 'cancellation_fee_revenue' WHERE "code" = '4901' AND "system_key" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "accounts" SET "system_key" = NULL WHERE "code" = '4901' AND "system_key" = 'cancellation_fee_revenue'`,
    );
  }
}
