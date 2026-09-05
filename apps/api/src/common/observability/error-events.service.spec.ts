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
  function createService(notifyEnabled = false) {
    const saved: Record<string, unknown>[] = [];
    const configCalls: unknown[][] = [];
    // 🔔 Ogohlantirish xizmati mock'i. Standart holatda O'CHIQ — eski
    // testlar aynan shu shartda yozilgan va ular ogohlantirish
    // mantiqidan mustaqil qolishi kerak.
    const alerts: string[] = [];
    const notifications = {
      get enabled() {
        return notifyEnabled;
      },
      send: jest.fn((text: string) => {
        alerts.push(text);
        return Promise.resolve(true);
      }),
    };
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
    const service = new ErrorEventsService(repo as never, notifications as never);
    return { service, repo, saved, configCalls, notifications, alerts };
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

// 🔔 OGOHLANTIRISH (2026-09-05).
//
// Bu blok "xato yozildi" bilan "odam bildi" o'rtasidagi bo'shliqni
// qo'riqlaydi. Uchta narsa muhim va uchalasi ham buzilishi oson:
//   1. sozlanmagan muhitda BUTUNLAY jim bo'lishi (aks holda har bir
//      test va lokal ishga tushirish tarmoqqa uchardi);
//   2. bir xil xato telefonni jiringlatib yubormasligi;
//   3. ogohlantirishning O'ZI xato jurnalini yiqitmasligi.
describe('ErrorEventsService — ogohlantirish', () => {
  const input = {
    requestId: 'req-9',
    statusCode: 500,
    method: 'POST',
    path: '/api/bookings/3f7c1a2b-1111-2222-3333-444455556666/check-in',
    tenantId: 't-1',
    userId: 'u-1',
    name: 'QueryFailedError',
    message: 'duplicate key: phone +998901234567 already exists',
    stack: 'stack...',
  };

  // `record()` ogohlantirishni ATAYLAB `await` qilmaydi (xato yo'li
  // Telegram'ni kutmasligi kerak), shuning uchun testda navbatni
  // bo'shatamiz.
  const flush = () => new Promise((r) => setImmediate(r));

  function make(notifyEnabled: boolean) {
    const saved: Record<string, unknown>[] = [];
    const alerts: string[] = [];
    const repo = {
      create: jest.fn((d: Record<string, unknown>) => ({ id: 'e1', ...d })),
      save: jest.fn((e: Record<string, unknown>) => {
        saved.push(e);
        return Promise.resolve(e);
      }),
      manager: {
        transaction: jest.fn((fn: (m: unknown) => Promise<unknown>) =>
          fn({
            query: () => Promise.resolve(),
            getRepository: () => repo,
          }),
        ),
      },
    };
    const notifications = {
      get enabled() {
        return notifyEnabled;
      },
      send: jest.fn((text: string) => {
        alerts.push(text);
        return Promise.resolve(true);
      }),
    };
    const service = new ErrorEventsService(repo as never, notifications as never);
    return { service, repo, saved, alerts, notifications };
  }

  afterEach(() => jest.restoreAllMocks());

  it("sozlanmagan bo'lsa hech narsa yubormaydi", async () => {
    const { service, notifications } = make(false);
    await service.record(input);
    await flush();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('yangi xato uchun bir marta xabar yuboradi', async () => {
    const { service, alerts } = make(true);
    await service.record(input);
    await flush();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Yangi xato');
    expect(alerts[0]).toContain('QueryFailedError');
  });

  // 🔴 Eng muhim qo'riqchi. Busiz har bir so'rov bitta xabar bo'lardi:
  // yiqilgan endpoint daqiqasiga o'nlab bildirishnoma yuborardi va odam
  // birinchi kuni Telegram'ni o'chirib qo'yardi — ya'ni ogohlantirish
  // o'z-o'zini yo'q qilardi.
  it("bir xil xato takrorlansa qo'shimcha xabar yubormaydi", async () => {
    const { service, alerts } = make(true);
    for (let i = 0; i < 8; i++) {
      await service.record(input);
      await flush();
    }
    expect(alerts).toHaveLength(1);
  });

  it("bir soatdan keyin o'sha xato uchun yana xabar keladi", async () => {
    const { service, alerts } = make(true);
    const t0 = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);

    await service.record(input);
    await flush();
    expect(alerts).toHaveLength(1);

    // 59 daqiqa — hali erta.
    now.mockReturnValue(t0 + 59 * 60_000);
    await service.record(input);
    await flush();
    expect(alerts).toHaveLength(1);

    // 61 daqiqa — "hali ham buzuq" xabari.
    now.mockReturnValue(t0 + 61 * 60_000);
    await service.record(input);
    await flush();
    expect(alerts).toHaveLength(2);
    expect(alerts[1]).toContain('davom etmoqda');
  });

  it("boshqa xato o'z xabarini oladi", async () => {
    const { service, alerts } = make(true);
    await service.record(input);
    await flush();
    await service.record({ ...input, name: 'RangeError', message: 'boshqa' });
    await flush();
    expect(alerts).toHaveLength(2);
  });

  // 🔴 MAXFIYLIK. Telegram — uchinchi tomon serveri. Xato matnida
  // mehmonning telefoni yoki hujjat raqami bo'lishi mumkin (PostgreSQL
  // noyoblik xatosi qiymatni o'z ichiga oladi). Xabarga NORMALLASHTIRILGAN
  // matn ketadi: barcha raqamlar `<n>` ga, id'lar `<id>` ga almashadi.
  it("xabarda telefon raqami va id chiqmaydi", async () => {
    const { service, alerts } = make(true);
    await service.record(input);
    await flush();
    expect(alerts[0]).not.toContain('998901234567');
    expect(alerts[0]).not.toContain('3f7c1a2b-1111-2222-3333-444455556666');
    // Yo'l esa tanib olinadigan holda qoladi.
    expect(alerts[0]).toContain('/api/bookings/:id/check-in');
  });

  // Ogohlantirish qo'shimcha qatlam: u yiqilsa ham asosiy vazifa
  // (bazaga yozish) bajarilishi SHART.
  it("Telegram yiqilsa ham xato yozuvi saqlanadi", async () => {
    const { service, notifications, saved } = make(true);
    notifications.send.mockRejectedValueOnce(new Error('tarmoq yo\'q'));
    await expect(service.record(input)).resolves.toBe('e1');
    await flush();
    expect(saved).toHaveLength(1);
  });
});
