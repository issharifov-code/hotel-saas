import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 🔬 AUTENTIFIKATSIYA KONTEKSTI (2026-09-05).
//
// NIMA UCHUN AYNAN SHU FAYL. `AuthContext` — ilovaning eng xavfli
// frontend qismi: u tokenni QAYERGA saqlashni hal qiladi, chiqishda
// serverni xabardor qiladi, va yaroqsiz token ko'rsa uni o'chirib
// tashlashi kerak. Bu mantiqning har bir tarmog'i buzilsa oqibati
// bevosita xavfsizlik: token qolib ketadi, chiqish "chiqarmaydi",
// yoki "meni eslab qol" belgilanmagan bo'lsa ham token brauzerda
// abadiy yotadi.
//
// Bugungacha bu fayl HECH QANDAY test bilan qoplanmagan edi.
//
// `apiFetch` mock qilinadi (tarmoq bu yerda mavzu emas), lekin
// token saqlash funksiyalari HAQIQIY qoladi — aynan ular tekshirilyapti.

const apiFetch = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, apiFetch };
});

const { AuthProvider, useAuth } = await import('./AuthContext');

const TOKEN_KEY = 'hotel_saas_token';

const ME = {
  id: 'u1',
  email: 'xodim@folio.one',
  fullName: 'Test Xodim',
  tenantId: 't1',
  tenantSubdomain: 'orzu',
  hasSampleData: false,
  isPlatformAdmin: false,
};

/** Kontekst holatini DOM'ga chiqaradigan sinov komponenti. */
function Probe() {
  const { user, loading, permissions, login, logout, can } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'yoq'}</span>
      <span data-testid="perms">{permissions.join(',')}</span>
      <span data-testid="can">{String(can('billing', 'view'))}</span>
      <button onClick={() => void login({ email: 'a@b.c', password: 'x', remember: false })}>
        kirish-eslamasdan
      </button>
      <button onClick={() => void login({ email: 'a@b.c', password: 'x' })}>kirish</button>
      <button onClick={() => logout()}>chiqish</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

/** Yo'lga qarab javob beradigan standart mock. */
function routeMock(overrides: Record<string, unknown> = {}) {
  apiFetch.mockImplementation((path: string) => {
    if (path in overrides) {
      const v = overrides[path];
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
    }
    if (path === '/auth/me') return Promise.resolve(ME);
    if (path === '/properties') return Promise.resolve([{ id: 'p1', name: 'Orzu' }]);
    if (path === '/me/permissions') return Promise.resolve(['billing:view']);
    if (path === '/auth/logout') return Promise.resolve(undefined);
    return Promise.resolve(null);
  });
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiFetch.mockReset();
  });

  it("token yo'q bo'lsa serverga umuman murojaat qilmaydi", async () => {
    routeMock();
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('yoq');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('saqlangan token bilan foydalanuvchi va ruxsatlar yuklanadi', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    routeMock();
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('xodim@folio.one'));
    expect(screen.getByTestId('perms')).toHaveTextContent('billing:view');
    expect(screen.getByTestId('can')).toHaveTextContent('true');
  });

  // 🔴 YAROQSIZ TOKEN O'CHIRILISHI SHART. Aks holda foydalanuvchi
  // "yuklanmoqda" holatida qotib qoladi yoki har safar 401 oladi va
  // o'zi brauzer xotirasini tozalamaguncha ilovaga kira olmaydi.
  it("yaroqsiz token o'chiriladi", async () => {
    localStorage.setItem(TOKEN_KEY, 'eski-tok');
    routeMock({ '/auth/me': new Error('401') });
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('yoq');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  // 🔴 `remember` — TOKEN QAYERDA YOTISHI. localStorage brauzer
  // yopilgandan keyin ham qoladi, sessionStorage esa tab bilan o'chadi.
  // Umumiy kompyuterdan kirgan xodim uchun bu farq muhim.
  it("\"eslab qol\" belgilanmasa token faqat sessiyada saqlanadi", async () => {
    routeMock({ '/auth/login': { accessToken: 'yangi-tok', user: ME } });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('kirish-eslamasdan'));

    await waitFor(() => expect(sessionStorage.getItem(TOKEN_KEY)).toBe('yangi-tok'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('standart holatda token brauzerda saqlanadi', async () => {
    routeMock({ '/auth/login': { accessToken: 'yangi-tok', user: ME } });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('kirish'));

    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe('yangi-tok'));
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  // 🔴 `remember` BACKEND'GA YUBORILMASLIGI KERAK. Backend DTO'sida
  // bunday maydon yo'q va `forbidNonWhitelisted: true` tufayli so'rov
  // 400 bilan qaytadi — ya'ni bu sirg'anish butun kirishni buzadi.
  it("\"eslab qol\" bayrog'i so'rov tanasiga tushmaydi", async () => {
    routeMock({ '/auth/login': { accessToken: 'tok', user: ME } });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('kirish-eslamasdan'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/auth/login', expect.anything()));
    const call = apiFetch.mock.calls.find((c) => c[0] === '/auth/login');
    const body = JSON.parse((call![1] as { body: string }).body);
    expect(body).toEqual({ email: 'a@b.c', password: 'x' });
    expect(body).not.toHaveProperty('remember');
  });

  // Bir email bir nechta mehmonxonada bo'lsa backend token o'rniga
  // tanlash ro'yxatini qaytaradi — bu HOLATDA token qo'yilmasligi kerak.
  it("mehmonxona tanlash talab qilinsa token qo'yilmaydi", async () => {
    routeMock({
      '/auth/login': { requiresTenantSelection: true, tenants: [{ subdomain: 'a', name: 'A' }] },
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('kirish'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('yoq'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  // 🔴 CHIQISH SERVERNI HAM XABARDOR QILISHI KERAK (xavfsizlik auditi L9):
  // faqat brauzerdan o'chirilsa, token serverda yana 8 soat amal qilaverardi.
  it('chiqish serverga xabar beradi va holatni tozalaydi', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    routeMock();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('xodim@folio.one'));

    await userEvent.click(screen.getByText('chiqish'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('yoq'));
    expect(apiFetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('perms')).toHaveTextContent('');
  });

  // 🔴 TARMOQ YO'Q BO'LSA HAM CHIQISH ISHLASHI SHART. Aks holda
  // internetsiz qolgan xodim tizimdan chiqa olmaydi.
  it('server javob bermasa ham chiqish amalga oshadi', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    routeMock({ '/auth/logout': new Error('tarmoq yo\'q') });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('xodim@folio.one'));

    await userEvent.click(screen.getByText('chiqish'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('yoq'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
