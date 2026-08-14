import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { RlsContextService } from './rls-context.service';

/**
 * Global interceptor: har bir so'rov tugaganda RlsContextService ochgan
 * tranzaksiyani commit (muvaffaqiyat) yoki rollback (xatolik) qiladi va
 * ulanishni pool'ga qaytaradi. Agar so'rov davomida RLS-himoyalangan hech
 * qanday repository ishlatilmagan bo'lsa (masalan auth/roles bilan ishlash
 * yoki guard 401/403 qaytarsa), bu no-op bo'ladi — qo'shimcha ulanish band
 * qilinmaydi.
 *
 * DIQQAT: RlsContextService REQUEST-scope, lekin bu interceptor'ning o'zi
 * `APP_INTERCEPTOR` orqali global ro'yxatdan o'tgan (demak singleton sifatida
 * yaratiladi). Shu sabab oddiy konstruktor-injection ISHLAMAYDI — har safar
 * `ModuleRef.resolve()` orqali JORIY SO'ROVGA mos RlsContextService
 * instansiyasini qo'lda olish kerak (rasmiy NestJS naqshi — "Durable
 * providers"/request-scoped resolve from a singleton).
 */
@Injectable()
export class RlsTransactionInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const contextId = ContextIdFactory.getByRequest(request);

    return from(this.moduleRef.resolve(RlsContextService, contextId, { strict: false })).pipe(
      switchMap((rlsContext) =>
        // Guard'lar (JwtAuthGuard va h.k.) shu nuqtada allaqachon ishlab
        // bo'lgan — `request.user` to'ldirilgan. `applyTenantContext()` shu
        // holatni RLS tranzaksiyasiga (u controller qurilishi chog'ida,
        // Guard'lardan OLDIN ochilgan bo'lishi mumkin) yozadi — haqiqiy
        // handler/repository so'rovlari boshlanishidan OLDIN.
        from(rlsContext.applyTenantContext()).pipe(
          switchMap(() =>
            next.handle().pipe(
              switchMap((result) => from(rlsContext.commit()).pipe(switchMap(() => of(result)))),
              catchError((err) => from(rlsContext.rollback()).pipe(switchMap(() => throwError(() => err)))),
            ),
          ),
        ),
      ),
    );
  }
}
