import { Logger } from '@nestjs/common';
import { NotificationsService, escapeHtml } from './notifications.service';

// 🔔 OGOHLANTIRISH XIZMATI (2026-09-05).
//
// Bu xizmatning eng muhim xususiyati — u BUZILMASLIGI kerak. U xato
// yo'lida chaqiriladi, ya'ni u yiqilsa xato jurnali ham, so'rov ham
// birga ketadi. Shuning uchun testlarning ko'pchiligi "yomon holatda
// nima bo'ladi?" degan savolga javob beradi: tarmoq yo'q, Telegram
// 400 qaytardi, sozlama yarim.

const TOKEN = '123456:AAH-fake-token-for-tests';
const CHAT = '-1001234567890';

function withEnv(vars: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return () => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

describe('escapeHtml', () => {
  // Telegram HTML rejimida yuboriladi. Xato matnida tasodifiy `<` bo'lsa
  // (masalan "Cannot read properties of <null>") Telegram uni teg deb
  // o'qiydi va BUTUN xabarni rad etadi — ya'ni aynan kerak paytda
  // ogohlantirish kelmaydi.
  it('teg belgilarini ekranlaydi', () => {
    expect(escapeHtml('a < b > c & d')).toBe('a &lt; b &gt; c &amp; d');
  });

  it('avval & ni almashtiradi (ikki marta ekranlash bo\'lmasin)', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
  });
});

describe('NotificationsService', () => {
  let restore: () => void = () => undefined;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as never;
    // Testlar logni iflos qilmasin.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restore();
    jest.restoreAllMocks();
  });

  // 🔴 Eng muhim standart holat. Repozitoriyni klonlagan yoki testni
  // ishga tushirgan har bir muhitda sirlar YO'Q — va o'sha yerda xizmat
  // tarmoqqa umuman chiqmasligi kerak.
  it("sirlarsiz o'chiq bo'ladi va tarmoqqa chiqmaydi", async () => {
    restore = withEnv({
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined,
    });
    const s = new NotificationsService();
    expect(s.enabled).toBe(false);
    await expect(s.send('salom')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Yarim sozlangan holat eng aldamchisi: odam "sozladim" deb o'ylaydi.
  it("faqat bitta o'zgaruvchi berilsa ham o'chiq qoladi", () => {
    restore = withEnv({
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: undefined,
    });
    expect(new NotificationsService().enabled).toBe(false);
  });

  it("bo'sh joydan iborat qiymat sozlangan hisoblanmaydi", () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: '   ', TELEGRAM_CHAT_ID: CHAT });
    expect(new NotificationsService().enabled).toBe(false);
  });

  it('sozlangan bo\'lsa Telegram API ga to\'g\'ri so\'rov yuboradi', async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    const s = new NotificationsService();
    await expect(s.send('<b>test</b>')).resolves.toBe(true);

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(String(opts.body)) as Record<string, unknown>;
    expect(body.chat_id).toBe(CHAT);
    expect(body.text).toBe('<b>test</b>');
    expect(body.parse_mode).toBe('HTML');
  });

  // Telegram chegarasi 4096 belgi. Uzun stack trace bilan xabar
  // butunlay rad etilardi.
  it('juda uzun xabarni kesadi', async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    await new NotificationsService().send('x'.repeat(10_000));
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { text: string };
    expect(body.text.length).toBeLessThanOrEqual(4_000);
  });

  it("Telegram xato qaytarsa `false` qaytaradi, lekin yiqilmaydi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'chat not found',
    });
    await expect(new NotificationsService().send('a')).resolves.toBe(false);
  });

  it("tarmoq yiqilsa ham `throw` qilmaydi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    await expect(new NotificationsService().send('a')).resolves.toBe(false);
  });

  // 🔴 SIR LOGGA TUSHMASIN. Token URL ichida turadi va `fetch` xatosi
  // ba'zan URL'ni xabarga qo'shadi. Render loglari saqlanadi va aynan
  // xatoni ko'rish uchun ochiladi — token o'sha yerdan chiqib ketardi.
  it("log xabarida tokenni yashiradi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(
      new Error(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed`),
    );
    await new NotificationsService().send('a');

    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(TOKEN);
    expect(logged).toContain('<token>');
  });

  // 🔴 O'Z-O'ZINI YO'Q QILISHDAN HIMOYA. Baza uzilganda har bir endpoint
  // o'z xatosini beradi — ya'ni o'nlab TURLI fingerprint. Har biri uchun
  // alohida xabar telefonni uzluksiz jiringlatardi va odam
  // bildirishnomani butunlay o'chirib qo'yardi.
  it("soatiga 15 tadan ortiq xabar yubormaydi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    const s = new NotificationsService();

    const results: boolean[] = [];
    for (let i = 0; i < 18; i++) results.push(await s.send(`xabar ${i}`));

    expect(results.filter(Boolean)).toHaveLength(15);
    expect(results.slice(15)).toEqual([false, false, false]);
  });

  it("chegaraga yetganda bir marta 'bostirildi' xabarini yuboradi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    const s = new NotificationsService();
    for (let i = 0; i < 20; i++) await s.send(`xabar ${i}`);
    await new Promise((r) => setImmediate(r));

    const texts = fetchMock.mock.calls.map(
      (c) => (JSON.parse(String((c[1] as RequestInit).body)) as { text: string }).text,
    );
    const suppressed = texts.filter((t) => t.includes('bostirildi'));
    // Jimgina to'xtash eng yomoni bo'lardi — odam hammasi joyida deb
    // o'ylardi. Lekin xabar ham FAQAT BITTA bo'lishi kerak.
    expect(suppressed).toHaveLength(1);
  });

  it("bir soatdan keyin chegara yangilanadi", async () => {
    restore = withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT });
    const t0 = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    const s = new NotificationsService();

    for (let i = 0; i < 16; i++) await s.send(`x${i}`);
    await expect(s.send('hali ham chegarada')).resolves.toBe(false);

    now.mockReturnValue(t0 + 61 * 60_000);
    await expect(s.send('yangi soat')).resolves.toBe(true);
  });
});
