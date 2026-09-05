import { MigrationInterface, QueryRunner } from 'typeorm';

// ⚡ BOLA JADVALLARDA OTA KALIT INDEKSLARI (2026-09-05).
//
// MUAMMO. PostgreSQL tashqi kalit (FK) uchun indeksni AVTOMATIK
// YARATMAYDI — faqat ota tomondagi PRIMARY KEY indekslanadi. Ya'ni
// "bitta hisob-fakturaning qatorlarini o'qish" kabi eng oddiy so'rov
// butun jadvalni ketma-ket skanerlaydi.
//
// Bu bazada muammo AYNIQSA og'ir, chunki bola jadvallarda RLS siyosati
// ota jadvalga EXISTS so'rovi bilan yozilgan (`invoice_lines` uchun:
// "shu qatorning invoice'i mening tenantimga tegishlimi?"). Ketma-ket
// skanerlash bu tekshiruvni har bir ortiqcha qator uchun ham qildiradi.
//
// O'LCHOV (haqiqiy PostgreSQL, 20 000 hisob-faktura / 120 000 qator,
// 60 000 buxgalteriya yozuvi / 120 000 qator — `EXPLAIN ANALYZE`):
//
//   Bitta hisob-faktura qatorlari:
//     indekssiz: 9.01 ms, 1602 bufer, 120 015 qator filtrda tashlandi
//     indeks b.: 0.13 ms,   11 bufer   -> ~69 barobar tez
//
//   Bitta buxgalteriya yozuvining qatorlari:
//     indekssiz: 9.68 ms, 1239 bufer
//     indeks b.: 2.77 ms,    1 bufer (indeks skani)
//
// NIMA UCHUN AYNAN SHU IKKITASI. Bir xil naqsh boshqa bola
// jadvallarda ham bor, lekin indeks bepul emas: har bir INSERT/UPDATE
// uni ham yangilaydi. Shuning uchun faqat (a) o'sishi cheklanmagan va
// (b) ota orqali muntazam o'qiladigan jadvallar olindi. `invoice_lines`
// har bir turishda o'sadi, `journal_entry_lines` esa har bir moliyaviy
// harakatda — bu ikkalasi bazadagi eng tez o'sadigan jadvallar.
//
// `invoice_payments` da bu indeks ALLAQACHON bor edi
// (`invoice_id, created_at`) — ya'ni naqsh ma'lum edi, faqat
// `invoice_lines` e'tibordan chetda qolgan. Shu sabab bu yerda ham
// aynan o'sha shakl ishlatiladi: qatorlar har doim `created_at`
// bo'yicha o'sish tartibida o'qiladi (InvoicingService.findById),
// ya'ni indeks tartiblashni ham bepul beradi.
//
// 🔴 O'LCHANIB RAD ETILGAN INDEKS. `journal_entries (tenant_id,
// property_id, entry_date)` ham sinaldi — aylanma-qoldiq va oylik
// daromad hisobotlari uchun. Foyda YO'Q: rejalashtiruvchi baribir
// `journal_entry_lines` ni to'liq skanerlab hash join qiladi
// (24.7 ms -> 28.3 ms, ya'ni bir oz YOMONROQ). Shuning uchun
// qo'shilmadi. Agregat hisobotlar sekinlashsa, yechim boshqa
// tomondan izlanadi (masalan oldindan hisoblangan jamlar).
export class AddChildTableIndexes1790300000000 implements MigrationInterface {
  name = 'AddChildTableIndexes1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_invoice_lines_invoice_created"
      ON "invoice_lines" ("invoice_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_journal_entry_lines_entry"
      ON "journal_entry_lines" ("journal_entry_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_journal_entry_lines_entry"`);
    await queryRunner.query(`DROP INDEX "IDX_invoice_lines_invoice_created"`);
  }
}
