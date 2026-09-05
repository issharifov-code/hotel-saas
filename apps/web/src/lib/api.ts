const TOKEN_KEY = 'hotel_saas_token';

// 2026-09-02: "Meni tizimda saqlab qol" (kirish sahifasi) uchun — `remember`
// true bo'lsa token localStorage'da (brauzer yopilgandan keyin ham saqlanadi),
// false bo'lsa faqat sessionStorage'da (shu tab yopilishi bilan o'chadi).
// getToken ikkalasini ham tekshiradi, shuning uchun qaysi rejimda kirilganidan
// qat'iy nazar ishlayveradi.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  // 📊 KUZATUV (2026-09-05). Backend har bir javobda `x-request-id`
  // qaytaradi, 5xx xatolarida esa uni javob tanasida ham beradi. Bu
  // qiymat serverdagi log qatorlari va `error_events` yozuvi bilan bir
  // xil — ya'ni foydalanuvchi shu qisqa kodni aytsa, xatoning butun izi
  // topiladi. Ilgari bunday bog'lovchi umuman yo'q edi.
  requestId: string | null;

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

// Barcha API so'rovlar shu funksiya orqali o'tadi: JWT header'ni avtomatik qo'shadi
// va xatoликni (Uzbek xabar bilan) ApiError sifatida uloqtiradi.
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? getToken() : null;

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.message || `So'rov xato bilan tugadi (${res.status})`;
    // Tanada bo'lmasa header'dan olinadi: 502/504 kabi javoblarda tana
    // umuman bo'lmasligi mumkin, header esa yetib keladi.
    const requestId: string | null =
      (typeof body?.requestId === 'string' ? body.requestId : null) ??
      res.headers.get('x-request-id');
    const text = Array.isArray(message) ? message.join(', ') : message;
    // 5xx — xabar ataylab umumiy ("kutilmagan xatolik"), ya'ni o'zi bilan
    // hech narsa aytmaydi. So'rov raqamini XABARNING O'ZIGA qo'shamiz:
    // shunda u sahifalarni birma-bir o'zgartirmasdan hamma joyda
    // ko'rinadi (xato matni o'nlab komponentda `err.message` orqali
    // chiqariladi). 4xx xabarlari toza qoladi — ular foydalanuvchiga
    // mo'ljallangan va tushunarli.
    const withId =
      res.status >= 500 && requestId ? `${text} (So'rov raqami: ${requestId.slice(0, 8)})` : text;
    throw new ApiError(withId, res.status, requestId);
  }

  return body as T;
}
