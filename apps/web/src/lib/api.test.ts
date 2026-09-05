import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, clearToken, getToken, setToken } from './api';

// 🔬 MARKAZIY SO'ROV QATLAMI (2026-09-05).
//
// Web tomonda birinchi testlar aynan shu faylda — sabab oddiy: ilovadagi
// HAR BIR so'rov shu funksiyadan o'tadi. U buzilsa, bitta sahifa emas,
// butun ilova buziladi, va buzilish turlari jimgina bo'ladi:
//
//   * token qo'shilmasa — har joyda 401, lekin sabab ko'rinmaydi;
//   * "eslab qol" mantig'i buzilsa — foydalanuvchi brauzerni yopganda
//     tizimdan chiqib qoladi (yoki aksincha, umumiy kompyuterda
//     tizimda qolib ketadi — bu xavfsizlik masalasi);
//   * so'rov raqami yo'qolsa — 2026-09-05 da qurilgan butun kuzatuv
//     zanjiri (foydalanuvchi ekrandagi kod → server logi →
//     `error_events`) uziladi.
//
// Bu testlar `fetch` ni mock qiladi: bu yerda tarmoq emas, KELISHUV
// tekshiriladi — qanday so'rov ketadi va javob qanday talqin qilinadi.

function mockResponse(opts: {
  status?: number;
  body?: unknown;
  json?: boolean;
  headers?: Record<string, string>;
}) {
  const { status = 200, body = null, json = true, headers = {} } = opts;
  const map = new Map(
    Object.entries({
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...headers,
    }).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function stubFetch(res: Response) {
  const fn = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const lastInit = (fn: ReturnType<typeof vi.fn>): RequestInit =>
  fn.mock.calls[0][1] as RequestInit;
const lastHeaders = (fn: ReturnType<typeof vi.fn>): Record<string, string> =>
  lastInit(fn).headers as Record<string, string>;

describe('token saqlash', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 🔴 "Meni eslab qol" — bu qulaylik emas, XAVFSIZLIK sozlamasi.
  // Belgilanmagan bo'lsa token faqat shu tabda yashashi kerak, ya'ni
  // umumiy (resepshn) kompyuterda brauzer yopilishi bilan yo'qoladi.
  it("eslab qolinganda localStorage'da saqlanadi", () => {
    setToken('abc', true);
    expect(localStorage.getItem('hotel_saas_token')).toBe('abc');
    expect(sessionStorage.getItem('hotel_saas_token')).toBeNull();
  });

  it("eslab qolinmaganda faqat sessionStorage'da saqlanadi", () => {
    setToken('abc', false);
    expect(sessionStorage.getItem('hotel_saas_token')).toBe('abc');
    expect(localStorage.getItem('hotel_saas_token')).toBeNull();
  });

  // 🔴 Rejim almashganda ESKI joyda qolib ketmasligi kerak, va bu
  // IKKALA yo'nalishda ham tekshirilishi shart.
  //
  // Dastlab bu yerda faqat bitta yo'nalish (eslab qol → eslab qolma)
  // sinalgan edi. Mutatsiya sinovi bo'shliqni ochdi: teskari
  // yo'nalishdagi tozalashni olib tashlaganda testlar YASHIL qolaverdi.
  //
  // Bu shunchaki nazariya emas. "Eslab qolma" deb kirgan odam keyin
  // "eslab qol" bilan qayta kirsa, eski sessiya tokeni tozalanmasa
  // ikkita token qolardi — va `getToken` localStorage'ni birinchi
  // o'qigani uchun sessiyadagi eskisi jimgina osilib qolardi.
  it("eslab qol → eslab qolma: sessiyaga o'tadi, lokal tozalanadi", () => {
    setToken('birinchi', true);
    setToken('ikkinchi', false);
    expect(localStorage.getItem('hotel_saas_token')).toBeNull();
    expect(sessionStorage.getItem('hotel_saas_token')).toBe('ikkinchi');
  });

  it("eslab qolma → eslab qol: lokalga o'tadi, sessiya tozalanadi", () => {
    setToken('birinchi', false);
    setToken('ikkinchi', true);
    expect(sessionStorage.getItem('hotel_saas_token')).toBeNull();
    expect(localStorage.getItem('hotel_saas_token')).toBe('ikkinchi');
  });

  it('ikkala joydan ham o\'qiy oladi', () => {
    sessionStorage.setItem('hotel_saas_token', 'sessiya');
    expect(getToken()).toBe('sessiya');
    localStorage.setItem('hotel_saas_token', 'lokal');
    // localStorage birinchi tekshiriladi.
    expect(getToken()).toBe('lokal');
  });

  it("chiqishda ikkala joydan ham o'chadi", () => {
    localStorage.setItem('hotel_saas_token', 'a');
    sessionStorage.setItem('hotel_saas_token', 'b');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("yo'lga /api prefiksi qo'shiladi", async () => {
    const fn = stubFetch(mockResponse({ body: { ok: true } }));
    await apiFetch('/properties');
    expect(fn.mock.calls[0][0]).toBe('/api/properties');
  });

  it('token bo\'lsa Authorization header qo\'shiladi', async () => {
    setToken('tok-123');
    const fn = stubFetch(mockResponse({ body: [] }));
    await apiFetch('/guests');
    expect(lastHeaders(fn).Authorization).toBe('Bearer tok-123');
  });

  it("token bo'lmasa Authorization header YO'Q", async () => {
    const fn = stubFetch(mockResponse({ body: [] }));
    await apiFetch('/public');
    expect(lastHeaders(fn).Authorization).toBeUndefined();
  });

  // 🔴 `auth: false` — login va ro'yxatdan o'tish so'rovlari uchun.
  // Eski token bilan yuborilsa server uni tekshirishga urinardi.
  it('auth: false bo\'lsa token yuborilmaydi', async () => {
    setToken('tok-123');
    const fn = stubFetch(mockResponse({ body: {} }));
    await apiFetch('/auth/login', { auth: false, method: 'POST' });
    expect(lastHeaders(fn).Authorization).toBeUndefined();
  });

  it('chaqiruvchi bergan header standartdan ustun turadi', async () => {
    const fn = stubFetch(mockResponse({ body: {} }));
    await apiFetch('/x', { headers: { 'Content-Type': 'text/plain' } });
    expect(lastHeaders(fn)['Content-Type']).toBe('text/plain');
  });

  it('JSON javobni qaytaradi', async () => {
    stubFetch(mockResponse({ body: { id: 'p1' } }));
    await expect(apiFetch<{ id: string }>('/x')).resolves.toEqual({ id: 'p1' });
  });

  it('JSON bo\'lmagan javobda null qaytaradi (204 kabi)', async () => {
    stubFetch(mockResponse({ status: 204, json: false }));
    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });
});

describe('apiFetch — xatolar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('4xx xabari serverdan kelgan holicha qoladi', async () => {
    stubFetch(
      mockResponse({ status: 409, body: { message: "Xona shu sana oralig'ida band" } }),
    );
    await expect(apiFetch('/x')).rejects.toThrow("Xona shu sana oralig'ida band");
  });

  // NestJS ValidationPipe xabarlarni MASSIV sifatida qaytaradi. Busiz
  // foydalanuvchi "[object Object]" yoki vergulsiz yopishgan matn ko'rardi.
  it('massiv shaklidagi validatsiya xabarlari birlashtiriladi', async () => {
    stubFetch(
      mockResponse({ status: 400, body: { message: ['email xato', 'parol qisqa'] } }),
    );
    await expect(apiFetch('/x')).rejects.toThrow('email xato, parol qisqa');
  });

  it('xabar bo\'lmasa umumiy matn beriladi', async () => {
    stubFetch(mockResponse({ status: 403, body: {} }));
    await expect(apiFetch('/x')).rejects.toThrow("So'rov xato bilan tugadi (403)");
  });

  it('ApiError statusni saqlaydi', async () => {
    stubFetch(mockResponse({ status: 401, body: { message: 'Kirish kerak' } }));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 401 });
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiError);
  });

  // 🔴 KUZATUV ZANJIRI (2026-09-05). 5xx xabari ataylab umumiy, ya'ni
  // o'zi bilan hech narsa aytmaydi. So'rov raqami xabarning O'ZIGA
  // qo'shiladi — shunda u o'nlab sahifani o'zgartirmasdan hamma joyda
  // ko'rinadi. Foydalanuvchi shu sakkiz belgini aytsa, server logi va
  // `error_events` yozuvi topiladi.
  it("5xx xabariga so'rov raqami qo'shiladi", async () => {
    stubFetch(
      mockResponse({
        status: 500,
        body: { message: 'Kutilmagan xatolik', requestId: 'a1b2c3d4-e5f6-7890' },
      }),
    );
    await expect(apiFetch('/x')).rejects.toThrow(
      "Kutilmagan xatolik (So'rov raqami: a1b2c3d4)",
    );
  });

  // 502/504 da tana umuman bo'lmasligi mumkin — header esa yetib keladi.
  it("tana bo'lmasa so'rov raqami header'dan olinadi", async () => {
    stubFetch(
      mockResponse({
        status: 502,
        json: false,
        headers: { 'x-request-id': 'ffeeddcc-1122' },
      }),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({
      requestId: 'ffeeddcc-1122',
      status: 502,
    });
  });

  // 4xx xabarlari foydalanuvchiga mo'ljallangan va tushunarli —
  // ularga texnik kod qo'shish faqat chalg'itardi.
  it("4xx xabariga so'rov raqami QO'SHILMAYDI", async () => {
    stubFetch(
      mockResponse({
        status: 409,
        body: { message: 'Xona band', requestId: 'a1b2c3d4' },
      }),
    );
    await expect(apiFetch('/x')).rejects.toThrow(/^Xona band$/);
  });
});
