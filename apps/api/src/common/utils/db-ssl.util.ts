import { Logger } from '@nestjs/common';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M8). Ilgari TLS har doim
// `{ rejectUnauthorized: false }` bilan ishlatilardi (`data-source.ts` va
// `app.module.ts` da bir xil). Ulanish SHIFRLANGAN, lekin
// AUTENTIFIKATSIYASIZ: mijoz ko'rsatilgan istalgan sertifikatni qabul
// qiladi, ya'ni ulanishni yo'naltira oladigan tomon o'z sertifikati bilan
// o'rtaga tushib, barcha so'rovlarni (jumladan baza kredensiallarini)
// o'qiy va o'zgartira olardi. TLS faqat passiv tinglashdan himoya qilardi.
//
// Nima uchun shunchaki `true` qilinmadi: Render'ning boshqariladigan
// Postgres'i o'z CA sertifikatiga ega va u Node'ning tizim ishonch
// do'konida bo'lmasligi mumkin — bunday o'zgarish ishlab chiqarishni
// darhol to'xtatib qo'yardi. Shuning uchun CA sozlanadigan qilindi:
//
//   * `DB_SSL_CA` berilgan  -> TO'LIQ tekshiruv (rejectUnauthorized: true)
//   * berilmagan            -> avvalgi xatti-harakat + production'da
//                              ogohlantirish (jimgina qolmasin)
//
// CA'ni Render dashboard'idagi baza sahifasidan olib, `DB_SSL_CA`
// o'zgaruvchisiga (PEM matni) qo'yish kifoya.
const logger = new Logger('DbSsl');

export type DbSslOption = false | { rejectUnauthorized: boolean; ca?: string };

let warned = false;

export function buildDbSsl(params: {
  enabled: boolean;
  ca?: string | null;
  isProduction: boolean;
}): DbSslOption {
  if (!params.enabled) return false;

  if (params.ca) {
    return { rejectUnauthorized: true, ca: params.ca };
  }

  if (params.isProduction && !warned) {
    warned = true;
    logger.warn(
      'DB_SSL yoqilgan, lekin DB_SSL_CA berilmagan — TLS sertifikati TEKSHIRILMAYDI. ' +
        "Ulanish shifrlangan, ammo o'rtadagi hujumdan himoyalanmagan. " +
        "Render dashboard'idagi baza CA sertifikatini DB_SSL_CA ga qo'ying.",
    );
  }
  return { rejectUnauthorized: false };
}
