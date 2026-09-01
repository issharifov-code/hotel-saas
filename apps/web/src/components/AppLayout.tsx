import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SampleDataBanner } from './SampleDataBanner';
import { formatDayLabel } from '../lib/dates';
import folioOneLogo from '../assets/folio-one-logo.png';

interface NavItem {
  to: string;
  label: string;
  moduleKey?: string;
}

// OPERA Cloud'dagi kabi — chap menyudagi ~20 ta yassi (flat) link mazmuni
// bo'yicha guruhlarga bo'lingan. `label`i bor bo'lim ochiladigan (accordion)
// guruh sifatida, `label`siz bo'lim esa (bitta item bilan) oddiy standalone
// link sifatida ko'rsatiladi.
interface NavSection {
  key: string;
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  { key: 'home', items: [{ to: '/dashboard', label: 'Bosh sahifa' }] },
  {
    key: 'client-relations',
    label: 'Mehmonlar bilan aloqalar',
    items: [
      { to: '/guests', label: 'Mehmonlar', moduleKey: 'guest_crm' },
      { to: '/messaging', label: 'Xabarlar', moduleKey: 'guest_crm' },
    ],
  },
  {
    key: 'bookings',
    label: 'Bronlar',
    items: [
      { to: '/bookings', label: 'Bronlar taqvimi', moduleKey: 'booking' },
      { to: '/group-bookings', label: 'Guruh bronlari', moduleKey: 'booking' },
      { to: '/agencies', label: 'Agentliklar', moduleKey: 'booking' },
      { to: '/function-spaces', label: 'Tadbir zallari', moduleKey: 'booking' },
      { to: '/channel-manager', label: 'Channel Manager', moduleKey: 'booking' },
    ],
  },
  {
    key: 'front-desk',
    label: 'Front Desk',
    items: [{ to: '/night-audit', label: 'Kunni yopish', moduleKey: 'front_desk' }],
  },
  {
    key: 'inventory',
    label: 'Inventar',
    items: [
      { to: '/rooms', label: 'Xonalar', moduleKey: 'booking' },
      { to: '/housekeeping', label: 'Housekeeping', moduleKey: 'housekeeping' },
      { to: '/maintenance', label: 'Texnik xizmat', moduleKey: 'housekeeping' },
      { to: '/warehouse', label: 'Ombor', moduleKey: 'warehouse' },
    ],
  },
  { key: 'pos', items: [{ to: '/pos', label: 'POS', moduleKey: 'pos' }] },
  {
    key: 'financials',
    label: 'Moliyaviy',
    items: [
      { to: '/invoicing', label: 'Hisob-fakturalar', moduleKey: 'invoicing' },
      { to: '/city-ledger', label: 'City Ledger', moduleKey: 'invoicing' },
      { to: '/accounting', label: 'Moliyaviy hisob', moduleKey: 'accounting' },
      { to: '/billing', label: "Obuna va to'lovlar", moduleKey: 'billing' },
    ],
  },
  {
    key: 'reports',
    label: 'Hisobotlar',
    items: [
      { to: '/segment-reports', label: 'Daromad tahlili', moduleKey: 'reports' },
      { to: '/guest-registration-report', label: "Ro'yxatga olish hisoboti", moduleKey: 'reports' },
    ],
  },
  { key: 'staff', items: [{ to: '/staff', label: 'Xodimlar va ruxsatlar', moduleKey: 'users_roles' }] },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4l6 6-6 6" />
    </svg>
  );
}

function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function BackChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 4.5L7 10l5.5 5.5" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="6.5" r="3.2" />
      <path strokeLinecap="round" d="M3.5 17c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="10" r="2.6" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 2.8v1.6M10 15.6v1.6M17.2 10h-1.6M4.4 10H2.8M15.1 4.9l-1.13 1.13M6.03 13.97L4.9 15.1M15.1 15.1l-1.13-1.13M6.03 6.03L4.9 4.9"
      />
    </svg>
  );
}

// Sahifa ilk marta ochilganda (yangi tab, to'g'ridan-to'g'ri URL) brauzer
// tarixida ortga qaytadigan joy yo'q — shu holatda "Orqaga" havolasini
// ko'rsatmaymiz (SPA ichidan chiqib ketmaslik uchun).
function canGoBackInHistory() {
  return typeof window !== 'undefined' && window.history.length > 1;
}

const WEEKDAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

// OPERA'dagi yuqori panelda ko'rsatilgan "Tuesday, 01 Sep, 2026" uslubidagi
// sana — property'ning joriy moliyaviy kuni (Kunni yopish moduli shu qiymatni
// yuritadi), taqvim sanasidan farq qilishi mumkin (audit hali yopilmagan bo'lsa).
function formatBusinessDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const { dayMonth } = formatDayLabel(isoDate);
  return `${WEEKDAY_FULL[date.getDay()]}, ${dayMonth}, ${y}`;
}

const SIDEBAR_COLLAPSE_KEY = 'folioOne.sidebarCollapsed';

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, property, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Brauzer tab sarlavhasi (2026-09): har bir sahifa AppLayout'ga o'z
  // `title` propini uzatadi — shu qiymatdan foydalanib sarlavhani markazlashtirib
  // qo'yamiz, alohida sahifalarga qo'lda tegish shart emas.
  useEffect(() => {
    document.title = `Folio One | ${title}`;
  }, [title]);

  // OPERA'dagi kabi mazmuniy guruhlash (2026-09): har bir bo'lim ruxsatga ega
  // item'largagina filtrlanadi; hech narsa qolmasa, butun bo'lim yashiriladi.
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.moduleKey || can(item.moduleKey, 'view')),
  })).filter((section) => section.items.length > 0);

  const activeGroupKey =
    visibleSections.find(
      (section) => section.label && section.items.some((item) => isRouteActive(location.pathname, item.to)),
    )?.key ?? null;

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroupKey ? [activeGroupKey] : []));

  // Joriy sahifa yopiq guruh ichida bo'lsa, uni avtomatik ochamiz — lekin
  // foydalanuvchi qo'lda yopgan boshqa guruhlarni qayta yopib qo'ymaymiz.
  useEffect(() => {
    if (!activeGroupKey) return;
    setExpanded((prev) => (prev.has(activeGroupKey) ? prev : new Set(prev).add(activeGroupKey)));
  }, [activeGroupKey]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showBack = canGoBackInHistory();

  // Chap menyuni yig'ish (2026-09, OPERA'dagi hamburger tugmasi kabi): har bir
  // sahifa o'z AppLayout nusxasini alohida mount qiladi (umumiy Outlet-layout
  // emas), shuning uchun oddiy useState navigatsiya paytida qayta tiklanib
  // ketardi — holatni localStorage'da saqlab, sahifalar orasida barqaror
  // qilib qo'yamiz.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // localStorage mavjud bo'lmasa (masalan, maxfiy oynada) sukut holatda davom etamiz
      }
      return next;
    });
  };

  return (
    // h-screen + flex-col + overflow-hidden (2026-09): butun ilova viewport
    // balandligiga qotib turadi — yuqoridagi OPERA uslubidagi panel va pastki
    // footer doim ko'rinadi, faqat o'rtadagi `main` tarkibi mustaqil aylanadi.
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* OPERA Cloud uslubidagi yuqori panel: hamburger, logotip, moliyaviy sana, foydalanuvchi, sozlamalar */}
      <header className="shrink-0 h-14 bg-slate-800 text-white flex items-center justify-between pl-3 pr-5 border-b-2 border-brand-gold">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            title={collapsed ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            className="p-1.5 rounded hover:bg-white/10 text-white/80 hover:text-white"
          >
            <HamburgerIcon />
          </button>
          <img src={folioOneLogo} alt="Folio One" className="h-6 w-6 shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold truncate">Folio One</p>
            {property && <p className="text-[11px] text-white/60 truncate">{property.name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {property && (
            <p className="hidden sm:block text-xs text-white/80">{formatBusinessDate(property.businessDate)}</p>
          )}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-white/80 min-w-0">
            <UserIcon />
            <span className="truncate max-w-[160px]">{user?.fullName || user?.email}</span>
          </div>
          <Link
            to="/staff"
            aria-label="Sozlamalar"
            title="Sozlamalar"
            className="p-1.5 rounded hover:bg-white/10 text-white/80 hover:text-white"
          >
            <GearIcon />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`shrink-0 h-full overflow-y-auto flex flex-col bg-white border-r border-slate-200 transition-[width] duration-150 ${
            collapsed ? 'w-0 overflow-hidden border-r-0' : 'w-60'
          }`}
        >
          <nav className="flex-1 px-3 py-4 space-y-0.5 w-60">
            {visibleSections.map((section) =>
              section.label ? (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.key)}
                    className="w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-brand-navy"
                  >
                    <span>{section.label}</span>
                    <ChevronIcon open={expanded.has(section.key)} />
                  </button>
                  {expanded.has(section.key) && (
                    <div className="space-y-0.5 mb-1">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `block rounded-md border-l-2 px-3 py-2 pl-5 text-sm font-medium ${
                              isActive
                                ? 'border-brand-gold bg-brand-navy-light text-brand-navy font-semibold'
                                : 'border-transparent text-slate-600 hover:bg-slate-100'
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-md border-l-2 px-3 py-2 pl-2.5 text-sm font-medium ${
                        isActive
                          ? 'border-brand-gold bg-brand-navy-light text-brand-navy font-semibold'
                          : 'border-transparent text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))
              ),
            )}
          </nav>
          <div className="px-5 py-4 border-t border-slate-100 w-60">
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            <button onClick={logout} className="mt-1 text-xs text-slate-600 hover:text-brand-navy underline">
              Chiqish
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 h-full flex flex-col">
          <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-4">
            {showBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-navy mb-1"
              >
                <BackChevronIcon />
                Orqaga
              </button>
            )}
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          </header>
          <main className="flex-1 overflow-y-auto px-8 py-6">
            <SampleDataBanner />
            {children}
          </main>
        </div>
      </div>

      {/* Pastki footer (2026-09) — OPERA'dagi "Oracle Hospitality | Copyright..." panelining Folio One versiyasi */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-5 py-2 flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">
          <span className="font-semibold text-slate-500">Folio One</span>
          <span className="mx-2 text-slate-300">|</span>
          Copyright &copy; 2026, Folio One. Barcha huquqlar himoyalangan.
        </span>
        <span className="shrink-0 ml-4">usali.uz</span>
      </footer>
    </div>
  );
}
