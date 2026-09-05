import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorEventsService } from './error-events.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

// 📊 KUZATUV (2026-09-05). Ilgari ilovada global exception filter yo'q
// edi — NestJS'ning standart filtri ishlardi. U xavfsiz (500 javobida
// stack chiqmaydi), lekin:
//
//   * xatoni SO'ROV KONTEKSTI bilan bog'lamaydi (kim, qaysi tenant,
//     qaysi marshrut) — logda faqat stack qoladi;
//   * hech qayerda SAQLAMAYDI, ya'ni Render loglari aylanib ketgach
//     xato haqidagi yagona dalil yo'qoladi;
//   * foydalanuvchiga hech qanday murojaat qilish belgisi bermaydi —
//     "xatolik yuz berdi" degan matn bilan qo'llab-quvvatlashga
//     murojaat qilishning foydasi yo'q edi.
//
// Endi har bir xato: so'rov ID bilan loglanadi, 5xx bo'lsa
// `error_events` ga yoziladi, va javobda `requestId` qaytariladi.
//
// XAVFSIZLIK. 5xx javoblarida ICHKI xabar mijozga BERILMAYDI — u
// bazadagi jadval nomlari, SQL matni yoki fayl yo'llarini oshkor
// qilishi mumkin. Mijoz umumiy matn va so'rov ID oladi; batafsiloti
// esa faqat serverda qoladi. 4xx (HttpException) javoblari o'zgarishsiz
// qaytadi — ular ataylab yozilgan, foydalanuvchiga mo'ljallangan
// xabarlar (validatsiya xatolari va h.k.).

// `HttpStatus` — enum, `status` esa oddiy `number` (chunki
// `HttpException.getStatus()` shunday qaytaradi). Ularni to'g'ridan-
// to'g'ri solishtirish ESLint'ning `no-unsafe-enum-comparison`
// qoidasiga tushadi, shuning uchun qiymat bir marta sonlashtiriladi.
const NOT_FOUND: number = HttpStatus.NOT_FOUND;

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId: string;
}

// 🔴 BAZA CHEKLOVI BUZILISHI — 500 EMAS, 409 (2026-09-05).
//
// MUAMMO. Bazadagi cheklovlar (unikal indeks, `EXCLUDE` bilan
// qo'yilgan bron kesishuvi) ilovaning eng ishonchli qo'riqchisi: ular
// ikkita bir vaqtdagi so'rov poygada uchrashganda ham ushlab qoladi.
// Lekin ushlaganda drayver xatosi ko'tariladi va u shu paytgacha
// oddiy 500 bo'lib chiqardi:
//
//   * foydalanuvchi "Serverda kutilmagan xatolik" degan matnni ko'rardi
//     — aslida hech qanday xatolik yo'q, shunchaki kimdir undan bir
//     lahza oldin ulgurgan;
//   * yozuv `error_events` ga tushardi va Telegram ogohlantirishini
//     qo'zg'atardi — ya'ni normal raqobat holati "avariya" sifatida
//     xabar qilinardi.
//
// Endi bunday xato 409 (Conflict) bo'lib qaytadi. Cheklov NOMI
// mijozga BERILMAYDI (jadval/indeks nomlari — ichki tafsilot), lekin
// serverda `warn` bilan yoziladi: agar bu haqiqatan ilova mantiqidagi
// nuqson bo'lsa, u logda ko'rinadi.
//
// Bu ATAYLAB TOR: faqat "allaqachon mavjud" (23505) va "oraliq band"
// (23P01). Boshqa baza xatolari (masalan 23503 — mavjud bo'lmagan
// yozuvga havola) haqiqatan nuqson bo'lgani uchun 500 bo'lib qoladi.
const DB_CONFLICT_MESSAGES: Record<string, string> = {
  '23505': 'Bu ma\'lumot allaqachon mavjud',
  '23P01': "Bu vaqt oralig'i allaqachon band",
};

/** PostgreSQL xato kodini (agar bo'lsa) qaytaradi. */
function pgErrorCode(exception: unknown): string | null {
  if (!exception || typeof exception !== 'object') return null;
  const driver = (exception as { driverError?: unknown }).driverError;
  const source = (driver ?? exception) as { code?: unknown };
  return typeof source.code === 'string' ? source.code : null;
}

/** Buzilgan cheklov nomi — faqat server logi uchun. */
function pgConstraintName(exception: unknown): string | null {
  if (!exception || typeof exception !== 'object') return null;
  const driver = (exception as { driverError?: unknown }).driverError;
  const source = (driver ?? exception) as { constraint?: unknown };
  return typeof source.constraint === 'string' ? source.constraint : null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly errorEvents: ErrorEventsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const dbConflictMessage = DB_CONFLICT_MESSAGES[pgErrorCode(exception) ?? ''];

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : dbConflictMessage
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.requestId ?? 'unknown';
    const context = {
      requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      tenantId: request.user?.tenantId ?? null,
      userId: request.user?.userId ?? null,
    };

    const name =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const rawMessage =
      exception instanceof Error ? exception.message : String(exception);

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({ ...context, status, name, message: rawMessage }),
        exception instanceof Error ? exception.stack : undefined,
      );
      // `void` — javob yozilishini xato jurnaliga bog'lamaymiz.
      // Foydalanuvchi bazadagi sekinlik yoki uzilish tufayli javobni
      // kutib qolmasligi kerak.
      void this.errorEvents.record({
        ...context,
        statusCode: status,
        name,
        message: rawMessage,
        stack: exception instanceof Error ? (exception.stack ?? null) : null,
      });
    } else if (status !== NOT_FOUND) {
      // 4xx — kutilgan holat, shuning uchun `warn` va stack'siz.
      // 404 ataylab chiqarib tashlangan: u eng ko'p uchraydigan va eng
      // kam ma'noli qator (skanerlar, eski havolalar).
      this.logger.warn(
        JSON.stringify({
          ...context,
          status,
          name,
          // Cheklov nomi FAQAT logda — javobga chiqmaydi. Agar 409
          // aslida ilova mantiqidagi nuqson bo'lsa, izlash shu yerdan
          // boshlanadi.
          ...(dbConflictMessage
            ? { constraint: pgConstraintName(exception) }
            : {}),
          message: rawMessage,
        }),
      );
    }

    if (dbConflictMessage) {
      response.status(status).json({
        statusCode: status,
        message: dbConflictMessage,
        error: 'Conflict',
        requestId,
      });
      return;
    }

    response.status(status).json(this.buildBody(exception, status, requestId));
  }

  private buildBody(
    exception: unknown,
    status: number,
    requestId: string,
  ): ErrorResponseBody {
    if (exception instanceof HttpException && status < 500) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { statusCode: status, message: payload, requestId };
      }
      const obj = payload as Record<string, unknown>;
      return {
        statusCode: status,
        message: (obj.message as string | string[]) ?? exception.message,
        error: obj.error as string | undefined,
        requestId,
      };
    }

    // 5xx — ichki tafsilot mijozga chiqmaydi.
    return {
      statusCode: status,
      message:
        "Serverda kutilmagan xatolik yuz berdi. Qo'llab-quvvatlashga murojaat qilsangiz, quyidagi so'rov raqamini ayting.",
      error: 'Internal Server Error',
      requestId,
    };
  }
}
