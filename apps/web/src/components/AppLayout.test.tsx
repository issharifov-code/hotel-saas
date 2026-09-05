import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 🔬 RUXSATGA QARAB MENYU (2026-09-05).
//
// NIMA UCHUN BU QO'RIQLANISHI KERAK. Ilova menyusi ruxsatlar bo'yicha
// filtrlanadi: `can('billing', 'view')` bo'lmagan xodim "Obuna va
// to'lovlar" ni ko'rmasligi kerak. Bu XAVFSIZLIK EMAS — haqiqiy himoya
// serverda (RLS + PermissionsGuard) — lekin buzilsa oqibati og'ir:
// xodim bosadi, 403 oladi va tizim buzuq deb o'ylaydi. Yoki undan ham
// yomoni: ko'rmasligi kerak bo'lgan bo'lim borligini biladi.
//
// Bu mantiq bugungacha HECH NARSA bilan tekshirilmagan edi (web tomonda
// 0 ta test bor edi).
//
// `useAuth` mock qilinadi: bu yerda autentifikatsiya emas, MENYUNING
// ruxsatga munosabati tekshiriladi.

const mockAuth = {
  user: {
    id: 'u1',
    email: 'xodim@folio.one',
    fullName: 'Test Xodim',
    tenantId: 't1',
    tenantSubdomain: 'orzu',
    hasSampleData: false,
    isPlatformAdmin: false,
  } as Record<string, unknown> | null,
  property: {
    id: 'p1',
    name: 'Orzu Hotel',
    logoUrl: null,
    businessDate: '2026-09-05',
    currency: 'UZS',
  } as Record<string, unknown> | null,
  permissions: [] as string[],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  can: (moduleKey: string, action: string) =>
    mockAuth.permissions.includes(`${moduleKey}:${action}`),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Namunaviy ma'lumot bannerining o'z so'rovlari bor — u bu testning
// mavzusi emas.
vi.mock('./SampleDataBanner', () => ({ SampleDataBanner: () => null }));

const { AppLayout } = await import('./AppLayout');

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout title="Bosh sahifa">
        <div>kontent</div>
      </AppLayout>
    </MemoryRouter>,
  );
}

/** Chap panel (hamburger) ni ochadi va uning ichini qaytaradi. */
async function openDrawer() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Menyuni ochish/i }));
  return within(screen.getByRole('dialog', { name: 'Asosiy menyu' }));
}

describe('AppLayout — chap paneldagi sozlamalar menyusi', () => {
  beforeEach(() => {
    mockAuth.permissions = [];
  });

  it("hech qanday ruxsati yo'q xodimda sozlama havolalari ko'rinmaydi", async () => {
    renderLayout();
    const drawer = await openDrawer();

    expect(drawer.queryByText('Mehmonxona')).not.toBeInTheDocument();
    expect(drawer.queryByText("Obuna va to'lovlar")).not.toBeInTheDocument();
    expect(drawer.queryByText('Kanal menejeri')).not.toBeInTheDocument();
  });

  // 🔴 GURUH SARLAVHASI YOLG'IZ QOLMASLIGI KERAK. Ruxsatlar bo'yicha
  // filtrlashdan keyin bo'sh qolgan guruh BUTUNLAY tushib qolishi
  // kerak — aks holda foydalanuvchi "SOTUV KANALLARI" degan sarlavhani
  // ko'radi, ostida esa hech narsa yo'q.
  it("bo'sh qolgan guruh sarlavhasi ham ko'rinmaydi", async () => {
    mockAuth.permissions = ['tenant_settings:view'];
    renderLayout();
    const drawer = await openDrawer();

    expect(drawer.getByText('Umumiy')).toBeInTheDocument();
    expect(drawer.queryByText('Sotuv kanallari')).not.toBeInTheDocument();
  });

  it('ruxsat berilgan havola guruhi bilan birga chiqadi', async () => {
    mockAuth.permissions = ['booking:view'];
    renderLayout();
    const drawer = await openDrawer();

    expect(drawer.getByText('Sotuv kanallari')).toBeInTheDocument();
    expect(drawer.getByText('Kanal menejeri')).toBeInTheDocument();
    // `booking:view` "Xonalar va xona turlari" ni ham ochadi — ular
    // bir modulga tegishli.
    expect(drawer.getByText('Xonalar va xona turlari')).toBeInTheDocument();
    // Lekin boshqa modul havolalari YO'Q.
    expect(drawer.queryByText("Obuna va to'lovlar")).not.toBeInTheDocument();
  });

  it("har bir havola o'z ruxsati bilan alohida ochiladi", async () => {
    mockAuth.permissions = ['billing:view'];
    renderLayout();
    const drawer = await openDrawer();

    expect(drawer.getByText("Obuna va to'lovlar")).toBeInTheDocument();
    expect(drawer.queryByText('Mehmonxona')).not.toBeInTheDocument();
    expect(drawer.queryByText('Xabarlar')).not.toBeInTheDocument();
  });

  it("to'liq ruxsatli egada ikkala guruh ham to'liq chiqadi", async () => {
    mockAuth.permissions = [
      'tenant_settings:view',
      'billing:view',
      'booking:view',
      'users_roles:view',
      'guest_crm:view',
    ];
    renderLayout();
    const drawer = await openDrawer();

    expect(drawer.getByText('Umumiy')).toBeInTheDocument();
    expect(drawer.getByText('Sotuv kanallari')).toBeInTheDocument();
    for (const label of [
      'Mehmonxona',
      "Obuna va to'lovlar",
      'Xonalar va xona turlari',
      'Rollar',
      'Xabarlar',
      'Kanal menejeri',
    ]) {
      expect(drawer.getByText(label)).toBeInTheDocument();
    }
  });

  // 🔴 PLATFORMA ADMINI — bu tenant ichidagi rol emas, butun tizim
  // egasi. Uning havolasi oddiy xodimda HECH QACHON ko'rinmasligi
  // kerak: u boshqa mehmonxonalarning ma'lumotiga olib boradi.
  it("platforma boshqaruvi oddiy xodimda ko'rinmaydi", async () => {
    mockAuth.permissions = ['tenant_settings:view'];
    renderLayout();
    const drawer = await openDrawer();
    expect(drawer.queryByText('Platforma boshqaruvi')).not.toBeInTheDocument();
  });

  it('platforma admini uchun ko\'rinadi', async () => {
    mockAuth.user = { ...(mockAuth.user as object), isPlatformAdmin: true };
    renderLayout();
    const drawer = await openDrawer();
    expect(drawer.getByText('Platforma boshqaruvi')).toBeInTheDocument();
    // Keyingi testlarga o'tib ketmasin.
    mockAuth.user = { ...(mockAuth.user as object), isPlatformAdmin: false };
  });
});
