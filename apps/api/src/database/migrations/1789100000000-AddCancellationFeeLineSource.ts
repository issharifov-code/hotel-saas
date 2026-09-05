import { MigrationInterface, QueryRunner } from 'typeorm';

// Bekor qilish / no-show jarimasi uchun alohida folio qator turi
// (2026-09-05, kod auditi topilmasi).
//
// Muammo: `createFeeInvoice` jarima qatorini `adjustment` turi bilan
// yozardi va bosh kitobda `cancellation_fee_revenue` (4901, Miscellaneous
// Income) ni kreditlardi. Lekin `InvoicingService.cancel` teskari yozuvda
// `adjustment` ni `room_charge` bilan bitta guruhga qo'shib,
// `room_revenue` (4130, Rooms) ga qarshi qaytarardi.
//
// Natijada jarima kechirilganda debitorlik to'g'ri yopilar, ammo Rooms
// daromadi kamayib, Miscellaneous Income oshib qolardi. Oborot-balans
// baribir teng bo'lgani uchun buni hech narsa ko'rsatmasdi — faqat
// departamental hisobot noto'g'ri chiqardi.
//
// `adjustment` turining o'zi qoladi: u xona almashtirish/sana o'zgartirish
// natijasidagi narx farqi uchun ishlatiladi va u HAQIQATAN `room_revenue`ga
// tegishli. Ya'ni bitta tur ikki xil daromad hisobiga ishlatilayotgani
// muammoning ildizi edi.
//
// Mavjud qatorlar ko'chirilmaydi: `cancel` faqat to'lov olinmagan
// hisob-fakturani teskari qiladi, va eski jarima hisob-fakturalari
// ISSUED holatida. Tarixiy yozuvni qayta talqin qilishdan ko'ra, xatoni
// bugundan boshlab to'xtatish xavfsizroq.
export class AddCancellationFeeLineSource1789100000000
  implements MigrationInterface
{
  name = 'AddCancellationFeeLineSource1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."invoice_lines_source_enum" ADD VALUE IF NOT EXISTS 'cancellation_fee'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum'dan qiymat o'chirish butun turni qayta yaratishni
    // talab qiladi va bu qiymatga ega qatorlar bo'lsa ma'lumot yo'qoladi.
    // Loyihada bu ataylab qabul qilingan yondashuv (qarang:
    // `accounts_department_enum` izohi) — qiymat qolaveradi, zarari yo'q.
  }
}
