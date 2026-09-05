import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Pul/miqdor maydonlari
// `@IsNumberString()` bilan tekshirilardi. U esa `validator.isNumeric` ga
// tayanadi, ya'ni `-5000000`, `+999` va istalgan kattalikdagi sonni
// QABUL QILADI (empirik tasdiqlangan).
//
// Nima uchun bu buxgalteriyada xavfli. `AccountingService.postSimpleEntry`
// manfiy summada debet/kredit hisoblarini ATAYLAB almashtiradi — bu
// ichki primitiv uchun to'g'ri xatti-harakat (masalan ombor kamayishi,
// bekor qilingan xizmat haqi). Lekin manfiy qiymat FOYDALANUVCHI kiritgan
// maydondan kelib qolsa, oddiy xodim rolidagi kishi bosh kitobda teskari
// provodka yasay olardi:
//
//   * manfiy POS menyu narxi -> `ROOM_ACCOUNT` bilan to'langanda mehmon
//     folio balansi hech qanday qaytarish yozuvisiz kamayadi;
//   * manfiy xarid narxi -> `accounts_payable` kamayadi (`receive()`
//     faqat manfiy MIQDORNI to'sadi, narxni emas);
//   * manfiy maosh -> teskari payroll provodkasi.
//
// Shuning uchun tekshiruv INPUT darajasida bo'lishi kerak: `postSimpleEntry`
// ning manfiy summani qayta ishlashi qoladi (u yerda bu to'g'ri), lekin
// unga foydalanuvchidan manfiy qiymat yetib bormaydi.
//
// Butun qism 10 xonagacha cheklangan: eng tor ustun `numeric(12,2)`,
// ya'ni 10 butun xona. Bu bir vaqtning o'zida `numeric` to'lib ketishidan
// (500 xato) ham himoya qiladi.

const INT_DIGITS = 10;

function money(): RegExp {
  return new RegExp(`^\\d{1,${INT_DIGITS}}(\\.\\d{1,2})?$`);
}

/** Pul summasi: manfiy emas, 2 kasr xona (numeric(12,2) / numeric(14,2)). */
export function IsMoneyString(field: string) {
  return applyDecorators(
    Matches(money(), {
      message: `${field} manfiy bo'lmagan son bo'lishi kerak (masalan "350000.00"), eng ko'pi 2 kasr xona`,
    }),
  );
}

/** Birlik tannarxi: manfiy emas, 4 kasr xona (numeric(14,4)). */
export function IsUnitCostString(field: string) {
  return applyDecorators(
    Matches(new RegExp(`^\\d{1,${INT_DIGITS}}(\\.\\d{1,4})?$`), {
      message: `${field} manfiy bo'lmagan son bo'lishi kerak, eng ko'pi 4 kasr xona`,
    }),
  );
}

/** Miqdor: manfiy emas, 3 kasr xona (numeric(12..14,3)). */
export function IsQuantityString(field: string) {
  return applyDecorators(
    Matches(new RegExp(`^\\d{1,${INT_DIGITS}}(\\.\\d{1,3})?$`), {
      message: `${field} manfiy bo'lmagan son bo'lishi kerak, eng ko'pi 3 kasr xona`,
    }),
  );
}

/**
 * Ishorali miqdor — inventarizatsiya tuzatishi uchun ATAYLAB manfiy
 * bo'lishi mumkin. Aynan shu yagona joyda manfiy qiymat mo'ljallangan,
 * shuning uchun u alohida, aniq nomlangan dekorator bilan beriladi:
 * "manfiyga ruxsat" qarori kodda ko'rinib tursin.
 */
export function IsSignedQuantityString(field: string) {
  return applyDecorators(
    Matches(new RegExp(`^-?\\d{1,${INT_DIGITS}}(\\.\\d{1,3})?$`), {
      message: `${field} son bo'lishi kerak, eng ko'pi 3 kasr xona`,
    }),
  );
}

/**
 * Foiz: 0 dan 100 gacha, 2 kasr xona (numeric(5,2)).
 *
 * Ilgari `commissionPct` da hech qanday chegara yo'q edi — `"10000"`
 * yuborilsa turagent komissiyasi bron qiymatidan 100 barobar ko'p
 * hisoblanardi.
 */
export function IsPercentString(field: string) {
  return applyDecorators(
    Matches(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, {
      message: `${field} 0 dan 100 gacha bo'lgan foiz bo'lishi kerak (masalan "10.00")`,
    }),
  );
}
