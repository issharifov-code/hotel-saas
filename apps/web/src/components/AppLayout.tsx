import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SampleDataBanner } from './SampleDataBanner';
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

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, property, logout, can } = useAuth();
  const location = useLocation();

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

  const onDashboard = location.pathname === '/dashboard';

  return (
    // h-screen + overflow-hidden (2026-09): sahifa o'zi scroll bo'lmaydi — chap
    // menyu va sarlavha doim ekranda qotib turadi, faqat `main` ichki tarkibi
    // mustaqil aylanadi. Avval butun sahifa birga scroll bo'lardi, shu sababli
    // uzun jadval/ro'yxatli sahifalarda chap menyu ko'zdan yo'qolib qolardi.
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <div className="h-1 w-full bg-brand-gold fixed top-0 left-0 z-10" aria-hidden="true" />
      <aside className="w-60 shrink-0 h-full overflow-y-auto flex flex-col bg-brand-navy">
        <div className="px-5 py-5 border-b border-white/10 mt-1">
          <div className="flex items-center gap-2">
            <img src={folioOneLogo} alt="Folio One" className="h-6 w-6" />
            <p className="font-semibold text-white">Folio One</p>
          </div>
          {property && <p className="text-xs text-white/50 mt-0.5">{property.name}</p>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleSections.map((section) =>
            section.label ? (
              <div key={section.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(section.key)}
                  className="w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/40 hover:text-white/70"
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
                          `block rounded-md px-3 py-2 pl-6 text-sm font-medium ${
                            isActive ? 'bg-brand-gold text-brand-navy-dark' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
                    `block rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-brand-gold text-brand-navy-dark' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))
            ),
          )}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-white/50 truncate">{user?.email}</p>
          <button onClick={logout} className="mt-1 text-xs text-white/70 hover:text-white underline">
            Chiqish
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 h-full flex flex-col">
        <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-4">
          {!onDashboard && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-navy mb-1"
            >
              <BackChevronIcon />
              Bosh sahifa
            </Link>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <SampleDataBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
