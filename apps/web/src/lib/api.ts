const TOKEN_KEY = 'hotel_saas_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
