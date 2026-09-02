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

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }

  return body as T;
}
