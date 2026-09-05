import { ExecutionContext } from '@nestjs/common';
import { AppThrottlerGuard } from './app-throttler.guard';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05) — ishlab chiqarishda aniqlangan davomi.
// Rate limiting joriy qilingandan keyin `usali.uz` da tekshirilganda u
// ishlamayotgani ma'lum bo'ldi: har so'rovda `x-ratelimit-remaining: 9`
// qaytardi, ya'ni hisoblagich kaliti har safar o'zgarardi (Render
// proksisining aylanib turadigan oraliq manzili).
//
// Bu testlar ikkita xatti-harakatni qo'riqlaydi:
//   1. kalit `X-Forwarded-For` ning BIRINCHI (haqiqiy mijoz) yozuvidan olinadi;
//   2. login/registratsiya kaliti IP emas, EMAIL — IP almashtirish bilan
//      bitta hisobga qarshi parol tanlashni chetlab o'tib bo'lmasin.
describe('AppThrottlerGuard', () => {
  // `getTracker`/`generateKey` — `protected`, shuning uchun testda
  // ataylab ochiq tipga keltiramiz.
  type Internals = {
    getTracker(req: Record<string, unknown>): Promise<string>;
    generateKey(
      context: ExecutionContext,
      tracker: string,
      name: string,
    ): string;
  };

  function createGuard(): Internals {
    return new AppThrottlerGuard(
      { throttlers: [] } as never,
      {} as never,
      {} as never,
    ) as unknown as Internals;
  }

  // `super.generateKey` context'dan controller klassi va handler nomini
  // o'qiydi, shuning uchun ular haqiqiy funksiya/klass bo'lishi kerak.
  class TestController {}
  function testHandler() {}

  function contextWithBody(body: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
      getHandler: () => testHandler,
      getClass: () => TestController,
    } as unknown as ExecutionContext;
  }

  describe('getTracker', () => {
    it("X-Forwarded-For ning birinchi yozuvini oladi (haqiqiy mijoz)", async () => {
      const guard = createGuard();
      await expect(
        guard.getTracker({ ips: ['203.0.113.7', '10.0.0.1'], ip: '10.0.0.1' }),
      ).resolves.toBe('203.0.113.7');
    });

    it("proksi bo'lmasa req.ip ga qaytadi", async () => {
      const guard = createGuard();
      await expect(guard.getTracker({ ips: [], ip: '198.51.100.4' })).resolves.toBe(
        '198.51.100.4',
      );
    });

    it("IP umuman aniqlanmasa ham barqaror kalit qaytaradi", async () => {
      const guard = createGuard();
      await expect(guard.getTracker({})).resolves.toBe('unknown');
    });
  });

  describe('generateKey', () => {
    it('email bor bo\'lsa kalit IP emas, email bo\'yicha quriladi', () => {
      const guard = createGuard();
      const fromIpA = guard.generateKey(
        contextWithBody({ email: 'Xodim@Example.UZ' }),
        '203.0.113.7',
        'default',
      );
      const fromIpB = guard.generateKey(
        contextWithBody({ email: 'xodim@example.uz' }),
        '198.51.100.4',
        'default',
      );
      // Turli IP, bir xil (registrga bog'liq bo'lmagan) email -> bir xil kalit.
      expect(fromIpA).toBe(fromIpB);
    });

    it('turli emaillar turli kalit beradi', () => {
      const guard = createGuard();
      const a = guard.generateKey(
        contextWithBody({ email: 'a@example.uz' }),
        '203.0.113.7',
        'default',
      );
      const b = guard.generateKey(
        contextWithBody({ email: 'b@example.uz' }),
        '203.0.113.7',
        'default',
      );
      expect(a).not.toBe(b);
    });

    it('email yo\'q bo\'lsa kalit IP bo\'yicha quriladi', () => {
      const guard = createGuard();
      const a = guard.generateKey(contextWithBody({}), '203.0.113.7', 'default');
      const b = guard.generateKey(contextWithBody({}), '198.51.100.4', 'default');
      expect(a).not.toBe(b);
    });

    it("email satr bo'lmasa (masalan obyekt) IP bo'yicha ishlaydi", () => {
      const guard = createGuard();
      const a = guard.generateKey(
        contextWithBody({ email: { $ne: null } }),
        '203.0.113.7',
        'default',
      );
      const b = guard.generateKey(contextWithBody({}), '203.0.113.7', 'default');
      expect(a).toBe(b);
    });
  });
});
