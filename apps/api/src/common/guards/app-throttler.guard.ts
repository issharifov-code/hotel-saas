import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05) — ishlab chiqarishda aniqlangan davomi.
//
// Rate limiting joriy qilingandan keyin ishlab chiqarishda tekshirilganda
// u ISHLAMAYOTGANI ma'lum bo'ldi: har so'rovda javob sarlavhasi
// `x-ratelimit-remaining: 9` qaytardi, ya'ni hisoblagich har safar
// noldan boshlanardi. Sabab — Render teskari proksisi ortida hisoblagich
// kaliti (`req.ip`) har so'rovda o'zgarardi.
//
// Render `X-Forwarded-For` ni TOZALAMAYDI, faqat o'ziga qo'shadi, va
// ro'yxatning BIRINCHI yozuvini haqiqiy mijoz IP'siga o'rnatadi. Express'da
// `trust proxy: 1` esa o'ngdan bitta sakraydi, ya'ni Render'ning ORALIQ
// (aylanib turadigan) manzilini beradi — shuning uchun ishlamasdi.
// Yechim: `trust proxy: true` (main.ts) + shu yerda `req.ips[0]`.
//
// Ochiq kelishuv: birinchi yozuvni mijozning o'zi ham yuborishi mumkin,
// ya'ni faqat IP'ga tayangan chegara IP almashtirish bilan chetlab
// o'tiladi. Aynan shu sababdan LOGIN uchun kalit IP emas — EMAIL:
// bitta hisobga qaratilgan parol tanlash hujumi IP almashtirish bilan
// chetlab o'tilmaydi. Ko'p email bo'ylab "parol sepish" esa umumiy
// IP chegarasi (300/daq) ostida qoladi.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = req.ips as string[] | undefined;
    const ip = ips?.length ? ips[0] : (req.ip as string | undefined);
    return Promise.resolve(ip ?? 'unknown');
  }

  protected generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ): string {
    const request = context.switchToHttp().getRequest<{
      body?: { email?: unknown };
    }>();
    const email = request?.body?.email;

    // Login/registratsiya: hisobga qaratilgan hujumni to'sish uchun
    // hisoblagich AYNAN EMAIL bo'yicha yuritiladi — hujumchi IP'ni
    // almashtirsa ham o'sha hisob uchun chegara o'sha-o'shaligicha qoladi.
    if (typeof email === 'string' && email.trim()) {
      return super.generateKey(
        context,
        `email:${email.trim().toLowerCase()}`,
        throttlerName,
      );
    }

    return super.generateKey(context, tracker, throttlerName);
  }
}
