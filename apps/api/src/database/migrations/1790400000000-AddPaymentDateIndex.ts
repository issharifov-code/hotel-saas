import { MigrationInterface, QueryRunner } from 'typeorm';

// ⚡ TO'LOV SANASI BO'YICHA INDEKS (2026-09-05).
//
// QAYERDA OG'RIYDI. Bosh sahifa (`ReportsService.getOverview`) 12 ta
// so'rovni parallel yuboradi va ularning eng og'iri — oxirgi 30 kunlik
// to'lovlar trendi:
//
//   SELECT to_char(payment.created_at, 'YYYY-MM-DD'), SUM(amount)
//   FROM invoice_payments payment
//   JOIN invoices invoice ON ...
//   WHERE invoice.tenant_id = ... AND payment.created_at >= ...
//
// `invoice_payments` da indeks bor edi, lekin u `(invoice_id,
// created_at)` — birinchi ustun `invoice_id` bo'lgani uchun "oxirgi 30
// kun" filtri undan FOYDALANA OLMAYDI. Natijada butun jadval
// skanerlanadi, va jadval BARCHA tenantlarning to'lovlarini saqlaydi
// — ya'ni bir mehmonxonaning bosh sahifasi boshqalarning ma'lumoti
// hajmiga qarab sekinlashadi.
//
// O'LCHOV (haqiqiy PostgreSQL, `EXPLAIN ANALYZE`):
//
//   60 000 to'lov:   27.4 ms -> 9.6 ms
//   180 000 to'lov:  66.5 ms -> 25.9 ms
//
// Ya'ni foyda hajm bilan birga o'sadi — bugun 27 ms muammo emas, lekin
// u chiziqli o'sadi va bosh sahifa har kirishda ochiladi.
//
// 🔴 QAMROVCHI (INCLUDE) VARIANT O'LCHANIB RAD ETILDI. `(created_at)
// INCLUDE (invoice_id, amount)` ham sinaldi — rejalashtiruvchi baribir
// Bitmap Heap Scan tanladi va natija yaxshilanmadi (29.3 ms), lekin
// indeks kattaroq bo'lardi. Oddiy bir ustunli indeks tanlandi.
export class AddPaymentDateIndex1790400000000 implements MigrationInterface {
  name = 'AddPaymentDateIndex1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_invoice_payments_created_at"
      ON "invoice_payments" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_invoice_payments_created_at"`);
  }
}
