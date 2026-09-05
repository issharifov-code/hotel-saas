import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 🔬 YO'NALISH QO'RIQCHILARI (2026-09-05).
//
// Bu qo'riqchilar XAVFSIZLIK CHEGARASI EMAS — haqiqiy himoya serverda
// (JwtAuthGuard, PlatformAdminGuard, RLS). Lekin ular buzilsa natija
// baribir jiddiy: kirmagan foydalanuvchi ilova ichidagi sahifani
// ochib, bo'sh yoki xato holatni ko'radi; yoki oddiy xodim `/admin`
// sahifasini ochib, boshqa mehmonxonalar mavjudligini biladi (server
// ma'lumot bermasa ham, sahifaning O'ZI ma'lumot).
//
// Ikkala qo'riqchi ham uch shoxli: yuklanmoqda / kirmagan / kirgan.
// Har bir shox alohida tekshiriladi.

const mockAuth = {
  user: null as Record<string, unknown> | null,
  loading: false,
};

vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { ProtectedRoute } = await import('./ProtectedRoute');
const { PlatformAdminRoute } = await import('./PlatformAdminRoute');

function renderGuard(guard: 'protected' | 'admin', path = '/maxfiy') {
  const Guard = guard === 'protected' ? ProtectedRoute : PlatformAdminRoute;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Kirish sahifasi</div>} />
        <Route path="/dashboard" element={<div>Bosh sahifa</div>} />
        <Route
          path="/maxfiy"
          element={
            <Guard>
              <div>Maxfiy kontent</div>
            </Guard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.loading = false;
  });

  // 🔴 YUKLANISH PAYTIDA QAROR QABUL QILINMASLIGI KERAK. Aks holda
  // sahifani yangilagan foydalanuvchi (token hali tekshirilmagan) bir
  // lahzaga kirish sahifasiga uloqtiriladi — va nima ochmoqchi bo'lgani
  // yo'qoladi.
  it("yuklanayotganda hech qayerga yo'naltirmaydi", () => {
    mockAuth.loading = true;
    renderGuard('protected');
    expect(screen.getByText('Yuklanmoqda...')).toBeInTheDocument();
    expect(screen.queryByText('Kirish sahifasi')).not.toBeInTheDocument();
    expect(screen.queryByText('Maxfiy kontent')).not.toBeInTheDocument();
  });

  it('kirmagan foydalanuvchi kirish sahifasiga yuboriladi', () => {
    renderGuard('protected');
    expect(screen.getByText('Kirish sahifasi')).toBeInTheDocument();
    expect(screen.queryByText('Maxfiy kontent')).not.toBeInTheDocument();
  });

  it("kirgan foydalanuvchi kontentni ko'radi", () => {
    mockAuth.user = { id: 'u1', isPlatformAdmin: false };
    renderGuard('protected');
    expect(screen.getByText('Maxfiy kontent')).toBeInTheDocument();
  });
});

describe('PlatformAdminRoute', () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.loading = false;
  });

  it("yuklanayotganda hech qayerga yo'naltirmaydi", () => {
    mockAuth.loading = true;
    renderGuard('admin');
    expect(screen.getByText('Yuklanmoqda...')).toBeInTheDocument();
  });

  it('kirmagan foydalanuvchi kirish sahifasiga yuboriladi', () => {
    renderGuard('admin');
    expect(screen.getByText('Kirish sahifasi')).toBeInTheDocument();
  });

  // 🔴 ENG MUHIM SHOX. Oddiy xodim platforma sahifasiga kira olmaydi —
  // u bosh sahifaga qaytariladi, "ruxsat yo'q" xatosi bilan emas.
  it('oddiy xodim bosh sahifaga qaytariladi', () => {
    mockAuth.user = { id: 'u1', isPlatformAdmin: false };
    renderGuard('admin');
    expect(screen.getByText('Bosh sahifa')).toBeInTheDocument();
    expect(screen.queryByText('Maxfiy kontent')).not.toBeInTheDocument();
  });

  it("platforma admini kontentni ko'radi", () => {
    mockAuth.user = { id: 'u1', isPlatformAdmin: true };
    renderGuard('admin');
    expect(screen.getByText('Maxfiy kontent')).toBeInTheDocument();
  });
});
