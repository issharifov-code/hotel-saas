import { Injectable, Logger } from '@nestjs/common';

// 🔔 OGOHLANTIRISH (2026-09-05).
//
// NIMA UCHUN BU KERAK EDI. Xato jurnali (`error_events`) allaqachon bor
// va admin sahifasida ko'rinadi — lekin uni KO'RISH uchun kimdir o'sha
// sahifani ochishi kerak. Ya'ni production'da bir endpoint yiqilsa,
// buni faqat mehmonxona qo'ng'iroq qilganda bilardik. Kuzatuvning
// halqasi shu yerda uzilgan edi: yozamiz, lekin hech kimga aytmaymiz.
//
// NEGA TELEGRAM. Bepul, bir soniyada telefonga tushadi, domen
// tasdiqlash, SMTP yoki to'lov talab qilmaydi va spam papkasiga
// tushmaydi. Email uchun alohida yuborish xizmati kerak bo'lardi —
// shoshilinch xabar uchun ortiqcha bo'g'in.
//
// SOZLANMAGAN BO'LSA — JIM. Ikkala o'zgaruvchi ham bo'lmasa xizmat
// shunchaki o'chib turadi: ilova baribir ko'tariladi, xato jurnali
// baribir yoziladi. Bu ataylab — ogohlantirish QO'SHIMCHA qatlam, u
// yo'qligi ilovani to'xtatib qo'ymasligi kerak.
const TELEGRAM_API = 'https://api.telegram.org';

// So'rov osilib qolmasin: xabar yuborish xato yo'lida (`record()`
// ichida) chaqiriladi, ya'ni sekin tarmoq butun jarayonni ushlab
// turmasligi kerak.
const SEND_TIMEOUT_MS = 5_000;

// Telegram xabari uchun chegara 4096 belgi. Stack trace bundan uzun
// bo'lishi mumkin, shuning uchun xavfsiz kesim.
const MAX_MESSAGE_LENGTH = 3_500;

// 🔴 UMUMIY TO'SIQ. Bitta xato guruhi uchun chegara `ErrorEventsService`
// da bor, lekin production'da BIR VAQTDA o'nlab turli xato paydo
// bo'lishi mumkin (masalan baza uzilganda har bir endpoint o'z xatosini
// beradi). Unda telefon uzluksiz jiringlaydi va odam bildirishnomani
// butunlay o'chirib qo'yadi — ya'ni ogohlantirish O'Z-O'ZINI yo'q
// qiladi. Shuning uchun soatiga umumiy chegara, va chegaraga yetganda
// oxirgi bitta "bostirildi" xabari yuboriladi.
const MAX_ALERTS_PER_HOUR = 15;
const HOUR_MS = 3_600_000;

/**
 * HTML rejimida yuboramiz (o'qilishi qulay: qalin sarlavha, `code`).
 * Shuning uchun xato matnidagi belgilar EKRANLANISHI shart — aks holda
 * xabardagi tasodifiy `<` Telegram tomonidan teg deb o'qiladi va butun
 * xabar rad etiladi (ya'ni aynan eng kerak paytda ogohlantirish kelmaydi).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private windowStart = Date.now();
  private sentInWindow = 0;
  private suppressedNoticeSent = false;

  constructor() {
    this.botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
    this.chatId = (process.env.TELEGRAM_CHAT_ID ?? '').trim();

    if (this.enabled) {
      this.logger.log('Ogohlantirish yoqilgan (Telegram).');
    } else if (this.botToken || this.chatId) {
      // Yarim sozlangan holat eng xavflisi: odam "sozladim" deb
      // o'ylaydi, lekin xabar kelmaydi. Buni ochiq aytamiz.
      this.logger.warn(
        "Ogohlantirish O'CHIQ: TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID ning faqat bittasi berilgan — ikkalasi ham kerak.",
      );
    } else {
      this.logger.log(
        "Ogohlantirish o'chiq (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID berilmagan).",
      );
    }
  }

  get enabled(): boolean {
    return this.botToken.length > 0 && this.chatId.length > 0;
  }

  /**
   * Xabar yuboradi. HECH QACHON `throw` qilmaydi va HECH QACHON
   * chaqiruvchini kutdirib qo'ymaydi — natija `boolean`, xolos.
   *
   * @returns yuborilgan bo'lsa `true`; o'chiq, chegaradan oshgan yoki
   *          xato bo'lsa `false`.
   */
  async send(text: string): Promise<boolean> {
    if (!this.enabled) return false;
    if (!this.allowSend()) return false;

    const body = text.slice(0, MAX_MESSAGE_LENGTH);
    try {
      const res = await fetch(
        `${TELEGRAM_API}/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: body,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        // Telegram xato sababini javob tanasida beradi ("chat not
        // found", "bot was blocked"). Sozlashdagi xatoni topish uchun
        // aynan shu matn kerak.
        const detail = await res.text().catch(() => '');
        this.logger.warn(
          `Telegram xabarini yuborib bo'lmadi (HTTP ${res.status}): ${this.redact(detail).slice(0, 300)}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Telegram xabarini yuborib bo'lmadi: ${this.redact(
          err instanceof Error ? err.message : String(err),
        )}`,
      );
      return false;
    }
  }

  /**
   * 🔴 SIRNI LOGDAN OLIB TASHLASH. Token URL ichida turadi
   * (`/bot<token>/sendMessage`), va `fetch` xatosi ba'zan URL'ni xabar
   * ichiga qo'shadi. Render loglari esa saqlanadi va ular xatoni
   * ko'rish uchun ochiladi — token o'sha yerdan chiqib ketishi mumkin
   * edi. Shuning uchun har qanday log matni avval shu yerdan o'tadi.
   */
  private redact(text: string): string {
    if (!this.botToken) return text;
    return text.split(this.botToken).join('<token>');
  }

  private allowSend(): boolean {
    const now = Date.now();
    if (now - this.windowStart >= HOUR_MS) {
      this.windowStart = now;
      this.sentInWindow = 0;
      this.suppressedNoticeSent = false;
    }
    if (this.sentInWindow < MAX_ALERTS_PER_HOUR) {
      this.sentInWindow += 1;
      return true;
    }
    if (!this.suppressedNoticeSent) {
      this.suppressedNoticeSent = true;
      this.logger.warn(
        `Ogohlantirish chegarasi (soatiga ${MAX_ALERTS_PER_HOUR} ta) to'ldi — qolganlari yuborilmaydi. Xato jurnali baribir yozilmoqda.`,
      );
      // Oxirgi bitta xabar: "men jim bo'ldim" deyish — jimgina
      // to'xtashdan yaxshiroq, aks holda odam hammasi joyida deb
      // o'ylaydi.
      void this.sendRaw(
        `⚠️ <b>Ogohlantirish bostirildi</b>\nSoatiga ${MAX_ALERTS_PER_HOUR} ta chegara to'ldi — juda ko'p turli xato kelmoqda. Admin sahifasidagi xato jurnalini oching.`,
      );
    }
    return false;
  }

  // Chegarani chetlab o'tadigan ichki yuborish — faqat "bostirildi"
  // xabari uchun. Tashqaridan chaqirilmaydi.
  private async sendRaw(text: string): Promise<void> {
    try {
      await fetch(`${TELEGRAM_API}/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch {
      // Bu xabar yetib bormasa ham qiladigan ish qolmadi.
    }
  }
}
