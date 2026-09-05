import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ErrorEventsService } from './error-events.service';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

// 📊 KUZATUV (2026-09-05). Platforma admini uchun — production'da
// nima buzilayotganini Render loglarini titkilamasdan ko'rish.
//
// Faqat platforma admini: yozuvlarda barcha tenantlarning marshrutlari
// va xato xabarlari bor, ya'ni bu tenantlararo ma'lumot. Bazada ham
// ikkinchi qatlam bor — o'qish `app.error_log_bypass` ni talab qiladi
// (migratsiya 1789800000000), shuning uchun bu guard bir kun tushib
// qolsa ham jadval ochilib ketmaydi.
@Controller('admin/error-events')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminErrorEventsController {
  constructor(
    private readonly errorEvents: ErrorEventsService,
    private readonly notifications: NotificationsService,
  ) {}

  // 🔔 Ogohlantirish holati — admin sahifasi "yoqilganmi?" degan
  // savolga javob berishi uchun. Token yoki chat id QAYTARILMAYDI,
  // faqat `true`/`false`.
  @Get('alerts/status')
  alertStatus(): { enabled: boolean } {
    return { enabled: this.notifications.enabled };
  }

  /**
   * Sinov xabari. Sozlash to'g'ri bajarilganini tekshirishning yagona
   * ishonchli yo'li — HAQIQIY xabar yuborib ko'rish. Aks holda odam
   * sozlaganiga ishonib yuradi va birinchi haqiqiy nosozlikda
   * ogohlantirish kelmaganini biladi.
   *
   * `Promise<...>` qaytaradi va natijani ochiq aytadi: `sent: false`
   * bo'lsa sabab Render loglarida (`NotificationsService` warn).
   */
  @Post('alerts/test')
  async testAlert(): Promise<{ enabled: boolean; sent: boolean }> {
    if (!this.notifications.enabled) return { enabled: false, sent: false };
    const sent = await this.notifications.send(
      "✅ <b>Folio One</b> — sinov xabari.\nOgohlantirish to'g'ri sozlangan: haqiqiy xato yuz berganda xabar shu yerga keladi.",
    );
    return { enabled: true, sent };
  }

  // Guruhlangan ko'rinish — "hozir nima buzilgan?" degan savolga
  // to'g'ridan-to'g'ri javob (xom ro'yxat emas).
  @Get('summary')
  summary(@Query('hours') hours?: string) {
    const parsed = Math.min(
      720,
      Math.max(1, parseInt(hours ?? '24', 10) || 24),
    );
    return this.errorEvents.summary(parsed);
  }

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.errorEvents.list(page, pageSize);
  }
}
