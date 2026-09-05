import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

// 📊 KUZATUV (2026-09-05). Ilgari muvaffaqiyatli so'rovlar umuman
// loglanmasdi — ya'ni "sayt sekin" degan shikoyatni tekshirishning yo'li
// yo'q edi, va xato yuz berganda undan oldin nima bo'lganini ko'rib
// bo'lmasdi.
//
// Bu interceptor har so'rov uchun BITTA tuzilgan (JSON) qator yozadi:
// metod, yo'l, status, davomiylik, so'rov ID, foydalanuvchi va tenant.
// JSON — Render'ning log qidiruvi matn bo'yicha ishlaydi, ya'ni
// `"requestId":"..."` yoki `"durationMs":` bo'yicha aniq qidirish
// mumkin bo'ladi.
//
// SHOVQIN NAZORATI. Har so'rovni yozish Hobby tarifidagi log hajmini
// tez to'ldiradi va foydali qatorlarni ko'mib yuboradi, shuning uchun:
//   * `/api/version` (health check har 30 soniyada) chiqarib tashlangan;
//   * dev muhitida Nest'ning o'z loglari yetarli, shuning uchun bu
//     faqat production'da yoqiladi;
//   * xato javoblari bu yerda YOZILMAYDI — ularni `AllExceptionsFilter`
//     to'liq kontekst bilan yozadi (ikki marta yozilmasin);
//   * sekin so'rovlar alohida `warn` bilan belgilanadi — ular aynan
//     qidiriladigan qatorlar.

const SLOW_REQUEST_MS = 2_000;
const SKIP_PATHS = new Set(['/api/version', '/api/health']);

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');
  private readonly enabled = process.env.NODE_ENV === 'production';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser & { requestId?: string }>();
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    if (SKIP_PATHS.has(path)) return next.handle();

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          const line = JSON.stringify({
            requestId: request.requestId ?? null,
            method: request.method,
            path,
            status: context.switchToHttp().getResponse<{ statusCode: number }>()
              .statusCode,
            durationMs,
            tenantId: request.user?.tenantId ?? null,
            userId: request.user?.userId ?? null,
          });
          if (durationMs >= SLOW_REQUEST_MS) {
            this.logger.warn(line);
          } else {
            this.logger.log(line);
          }
        },
        // Xato yo'li ataylab bo'sh: `AllExceptionsFilter` uni to'liqroq
        // kontekst bilan yozadi.
        error: () => undefined,
      }),
    );
  }
}
