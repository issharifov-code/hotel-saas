import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 🔬 NAMUNAVIY MA'LUMOTLAR BANNERI (2026-09-05).
//
// NIMA UCHUN AYNAN BU KOMPONENT. Uning ichidagi tugma BUTUN
// MEHMONXONANING ma'lumotini o'chiradi — mehmonlar, bronlar,
// hisob-fakturalar, ombor, POS yozuvlari. Va u nafaqat "namuna
// sifatida yaratilganlarini", balki foydalanuvchi O'ZI kiritgan
// hamma narsani ham o'chiradi.
//
// Ya'ni bu ilovadagi eng xavfli tugma. Uni qo'riqlaydigan uch qoida
// bor va uchalasi ham test bilan qoplanmagan edi:
//
//   1. Namunaviy ma'lumot yo'q bo'lsa — banner umuman ko'rinmaydi.
//   2. `tenant_settings:delete` ruxsati bo'lmagan xodimda ham
//      ko'rinmaydi. (Bu 2026-09-05 auditining topilmasi edi:
//      `hasSampleData` — TENANT bayrog'i, ya'ni ilgari yangi
//      mehmonxonaning HAR BIR xodimi — farrosh ham — bu tugmani
//      ko'rardi va bosgach 403 olardi.)
//   3. Bosish DARHOL o'chirmaydi — avval tasdiqlash oynasi chiqadi.

const apiFetch = vi.fn();

const mockAuth = {
  user: { hasSampleData: true } as Record<string, unknown> | null,
  permissions: ['tenant_settings:delete'] as string[],
  refresh: vi.fn().mockResolvedValue(undefined),
  can: (moduleKey: string, action: string) =>
    mockAuth.permissions.includes(`${moduleKey}:${action}`),
};

vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, apiFetch };
});

const { SampleDataBanner } = await import('./SampleDataBanner');

// `window.location.reload` — jsdom uni qo'llab-quvvatlamaydi
// ("Not implemented: navigation"). Uni almashtiramiz: shu bilan bir
// vaqtda O'CHIRISHDAN KEYIN ILOVA QAYTA YUKLANISHINI ham tekshirib
// olamiz (bu bezak emas: deyarli har bir sahifa o'chirilgan
// ma'lumotga bog'liq, qayta yuklanmasa ular eski holatni ko'rsatib
// turaveradi).
const reload = vi.fn();
Object.defineProperty(window, 'location', {
  configurable: true,
  value: { ...window.location, reload },
});

const OCHIRISH = "Namunaviy ma'lumotlarni o'chirish";
const TASDIQ = "Ha, hammasini o'chirish";

describe('SampleDataBanner', () => {
  beforeEach(() => {
    mockAuth.user = { hasSampleData: true };
    mockAuth.permissions = ['tenant_settings:delete'];
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(undefined);
    reload.mockClear();
    mockAuth.refresh.mockClear();
  });

  it("namunaviy ma'lumot yo'q bo'lsa banner ko'rinmaydi", () => {
    mockAuth.user = { hasSampleData: false };
    const { container } = render(<SampleDataBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("foydalanuvchi umuman yo'q bo'lsa banner ko'rinmaydi", () => {
    mockAuth.user = null;
    const { container } = render(<SampleDataBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  // 🔴 AUDIT TOPILMASI. Farrosh yoki front-desk xodimi butun tenant
  // ma'lumotini o'chiradigan tugmani KO'RMASLIGI kerak.
  it("o'chirish ruxsati bo'lmagan xodimda banner ko'rinmaydi", () => {
    mockAuth.permissions = ['tenant_settings:view'];
    const { container } = render(<SampleDataBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ruxsatli foydalanuvchida banner ko'rinadi", () => {
    render(<SampleDataBanner />);
    expect(screen.getByRole('button', { name: OCHIRISH })).toBeInTheDocument();
  });

  // 🔴 BIR BOSISHDA O'CHMAYDI. Tasdiqlash oynasi — bu yerdagi eng
  // muhim himoya, chunki amalni ortga qaytarib bo'lmaydi.
  it("tugma bosilganda darhol o'chirmaydi, avval tasdiq so'raydi", async () => {
    render(<SampleDataBanner />);

    await userEvent.click(screen.getByRole('button', { name: OCHIRISH }));

    expect(screen.getByText(/ortga qaytarib bo'lmaydi/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('bekor qilinsa hech narsa yuborilmaydi', async () => {
    render(<SampleDataBanner />);
    await userEvent.click(screen.getByRole('button', { name: OCHIRISH }));
    await userEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    expect(screen.queryByRole('button', { name: TASDIQ })).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("tasdiqlanganda DELETE so'rovi yuboriladi", async () => {
    render(<SampleDataBanner />);
    await userEvent.click(screen.getByRole('button', { name: OCHIRISH }));
    await userEvent.click(screen.getByRole('button', { name: TASDIQ }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/sample-data', { method: 'DELETE' }),
    );
    // Holat yangilanadi va ilova qayta yuklanadi.
    await waitFor(() => expect(mockAuth.refresh).toHaveBeenCalled());
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  // Xatoda oyna YOPILMASLIGI va xabar ko'rinishi kerak — aks holda
  // foydalanuvchi o'chirildi deb o'ylab qolardi.
  it("xato bo'lsa xabar ko'rsatiladi va oyna ochiq qoladi", async () => {
    apiFetch.mockRejectedValue(new Error('tarmoq yiqildi'));
    render(<SampleDataBanner />);
    await userEvent.click(screen.getByRole('button', { name: OCHIRISH }));
    await userEvent.click(screen.getByRole('button', { name: TASDIQ }));

    expect(await screen.findByText(/xatolik yuz berdi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TASDIQ })).toBeInTheDocument();
    // 🔴 XATODA QAYTA YUKLANMASLIK SHART: yuklansa xato xabari
    // ko'rinmay ketardi va foydalanuvchi o'chirildi deb o'ylardi.
    expect(reload).not.toHaveBeenCalled();
  });
});
