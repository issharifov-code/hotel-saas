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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly errorEvents: ErrorEventsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
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
        JSON.stringify({ ...context, status, name, message: rawMessage }),
      );
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
