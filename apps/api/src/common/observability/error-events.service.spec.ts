import { ErrorEventsService } from './error-events.service';
import {
  buildFingerprint,
  normalizeMessageForFingerprint,
  normalizePathForFingerprint,
} from './error-events.service';

describe('fingerprint yordamchilari', () => {
  it("yo'ldagi id'larni almashtiradi, ya'ni bir xil xato bir guruhga tushadi", () => {
    const a = normalizePathForFingerprint(
      '/api/bookings/3f2504e0-4f89-41d3-9a0c-0305e82c3301/check-in',
    );
    const b = normalizePathForFingerprint(
      '/api/bookings/9c858901-8a57-4791-81fe-4c455b099bc9/check-in',
    );
    expect(a).toBe(b);
    expect(a).toBe('/api/bookings/:id/check-in');
  });

  it("query string'ni tashlaydi (unda shaxsiy ma'lumot bo'lishi mumkin)", () => {
    expect(normalizePathForFingerprint('/api/guests?search=Ali+Valiyev')).toBe(
      '/api/guests',
    );
  });

  it('raqamli segmentlarni ham normallashtiradi', () => {
    expect(normalizePathForFingerprint('/api/reports/2026/09')).toBe(
      '/api/reports/:n/:n',
    );
  });

  it('xabardagi id va raqamlarni normallashtiradi', () => {
    const a = normalizeMessageForFingerprint(
      'Bron 3f2504e0-4f89-41d3-9a0c-0305e82c3301 topilmadi (42 urinish)',
    );
    const b = normalizeMessageForFingerprint(
      'Bron 9c858901-8a57-4791-81fe-4c455b099bc9 topilmadi (7 urinish)',
    );
    expect(a).toBe(b);
  });

  it('turli xatolar turli fingerprint oladi', () => {
    const base = { method: 'GET', path: '/api/rooms', name: 'TypeError' };
    expect(buildFingerprint({ ...base, message: 'x is undefined' })).not.toBe(
      buildFingerprint({ ...base, message: 'connection refused' }),
    );
    expect(buildFingerprint({ ...base, message: 'bir xil' })).toBe(
      buildFingerprint({ ...base, message: 'bir xil' }),
    );
  });
});

describe('ErrorEventsService', () => {
  // 🔴 SABOQ (2026-09-05). Bu mock ilgari `transaction: jest.fn()` edi —
  // ya'ni callback UMUMAN chaqirilmasdi. Natijada testlar yashil bo'lgani
  // holda jonli sinovda yozish RLS tufayli yiqildi (`INSERT ... RETURNING`
  // yangi qatorni O'QISH huquqini talab qiladi). Endi mock haqiqiy
  // tranzaksiya kabi ishlaydi: `set_config` chaqiruvini yozib boradi va
  // callback'ni HAQIQATAN bajaradi.
  function createService() {
    const saved: Record<string, unknown>[] = [];
    const configCalls: unknown[][] = [];
    const repo = {
      create: jest.fn((d: Record<string, unknown>) => ({ id: 'e1', ...d })),
      save: jest.fn((e: Record<string, unknown>) => {
        saved.push(e);
        return Promise.resolve(e);
      }),
      manager: {
        transaction: jest.fn((fn: (m: unknown) => Promise<unknown>) =>
          fn({
            query: (sql: string, params: unknown[]) => {
              configCalls.push(params);
              return Promise.resolve();
            },
            getRepository: () => repo,
          }),
        ),
      },
    };
    const service = new ErrorEventsService(repo as never);
    return { service, repo, saved, configCalls };
  }

  const input = {
    requestId: 'req-1',
    statusCode: 500,
    method: 'POST',
    path: '/api/bookings?draft=1',
    tenantId: null,
    userId: null,
    name: 'TypeError',
    message: 'nimadir buzildi',
    stack: 'stack...',
  };

  // Jonli sinovda topilgan nuqson uchun qo'riqchi: yozish bypass
  // ichida bo'lmasa `INSERT ... RETURNING` RLS tufayli yiqiladi.
  it('yozishda app.error_log_bypass yoqiladi', async () => {
    const { service, configCalls } = createService();
    await service.record(input);
    expect(configCalls).toContainEqual(['app.error_log_bypass', 'on']);
  });

  it('xatoni saqlaydi va query string olib tashlanadi', async () => {
    const { service, saved } = createService();
    await service.record(input);

    expect(saved).toHaveLength(1);
    // Query string shaxsiy ma'lumot tashishi mumkin — saqlanmaydi.
    expect(saved[0].path).toBe('/api/bookings');
    expect(saved[0].fingerprint).toEqual(expect.any(String));
  });

  it('bir xil xato daqiqasiga 10 martadan ortiq yozilmaydi (baza toshib ketmasin)', async () => {
    const { service, saved } = createService();
    for (let i = 0; i < 25; i++) await service.record(input);
    expect(saved).toHaveLength(10);
  });

  it("boshqa xato o'z chegarasiga ega — bir xato ikkinchisini to'sib qo'ymaydi", async () => {
    const { service, saved } = createService();
    for (let i = 0; i < 15; i++) await service.record(input);
    await service.record({ ...input, message: 'butunlay boshqa xato' });
    expect(saved).toHaveLength(11);
  });

  it("baza yiqilsa ham so'rovni yiqitmaydi (null qaytaradi)", async () => {
    const { service, repo } = createService();
    repo.save.mockRejectedValueOnce(new Error("baza yo'q"));
    await expect(service.record(input)).resolves.toBeNull();
  });
});
