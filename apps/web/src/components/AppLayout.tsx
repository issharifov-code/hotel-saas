import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SampleDataBanner } from './SampleDataBanner';
import { formatDayLabel } from '../lib/dates';
import folioOneLogo from '../assets/folio-one-logo.png';

interface NavItem {
  to?: string;
  label: string;
  moduleKey?: string;
  // 2026-09 (foydalanuvchi fikri, OPERA Cloud "Client Relations > Profiles >
  // Manage Profile" skrinshotiga moslab): ba'zi item'lar to'g'ridan-to'g'ri
  // link emas, balki ikkinchi darajali flyout-guruh — shunda `to` bo'lmaydi,
  // `children` esa haqiqiy link'larni saqlaydi. Hozircha faqat "Mijozlar"
  // bo'limida ishlatiladi (Profillar > Profillarni boshqarish/Xabarlar).
  children?: NavItem[];
}

// ADMIN_ITEMS/ROLES_ITEM hech qachon `children`ga ega bo'lmaydi — doim
// to'g'ridan-to'g'ri link. Shuning uchun `to` bu yerda majburiy (NavItem'dan
// farqli), TypeScript'ga aniqroq kafolat berish uchun.
interface LeafNavItem {
  to: string;
  label: string;
  moduleKey?: string;
}

// Bitta bo'lim ichidagi barcha item'larni (children ichidagilar ham) tekis
// ro'yxatga aylantiradi — faol-yo'l va breadcrumb tekshiruvlari uchun.
function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? flattenNavItems(item.children) : [item]));
}

// Yuqori gorizontal modul-panel (2026-09, 3-bosqich): foydalanuvchi bergan
// OPERA Cloud skrinshotidagi aniq guruhlash va nomlanishga moslashtirildi —
// Mijozlar / Bronlar / Front Desk / Nomer fondi / Moliya / Boshqa / Hisobotlar.
// `label`i bor bo'lim bosilganda ochiladigan dropdown-guruh, `label`siz bo'lim
// (bitta item bilan) esa to'g'ridan-to'g'ri link sifatida ko'rsatiladi.
interface NavSection {
  key: string;
  label?: string;
  items: NavItem[];
}

// "Bosh sahifa" endi standalone nav-item emas — modul panelining eng
// chetidagi F1 logotipi shu vazifani bajaradi (OPERA'da ham "OPERA Cloud"
// logotipi shu joyda va shu vazifada). "Xodimlar", "Ish haqi", "Davomat",
// "Obuna va to'lovlar" va "Rollarni boshqarish" bu yerdan olib tashlangan —
// endi OPERA'dagi kabi yuqori paneldagi hamburger orqali ochiladigan
// "Administratsiya" menyusida (pastga qarang, ADMIN_ITEMS/ROLES_ITEM).
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'client-relations',
    label: 'Mijozlar',
    // 2026-09 (foydalanuvchi fikri, OPERA Cloud skrinshoti): "Mehmonlar" va
    // "Xabarlar" endi to'g'ridan-to'g'ri emas, "Profillar" degan ikkinchi
    // darajali flyout-guruh ichida — aynan OPERA'dagi "Client Relations >
    // Profiles > Manage Profile" tuzilishiga moslab (Suspended Stays'ning
    // o'rnida bizda Xabarlar).
    items: [
      {
        label: 'Profillar',
        moduleKey: 'guest_crm',
        children: [
          { to: '/guests', label: 'Profillarni boshqarish', moduleKey: 'guest_crm' },
          { to: '/messaging', label: 'Xabarlar', moduleKey: 'guest_crm' },
        ],
      },
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
    label: 'Nomer fondi',
    items: [
      { to: '/rooms', label: 'Xonalar', moduleKey: 'booking' },
      { to: '/housekeeping', label: 'Housekeeping', moduleKey: 'housekeeping' },
      { to: '/maintenance', label: 'Texnik xizmat', moduleKey: 'housekeeping' },
      { to: '/warehouse', label: 'Ombor', moduleKey: 'warehouse' },
    ],
  },
  {
    key: 'financials',
    label: 'Moliya',
    items: [
      { to: '/invoicing', label: 'Hisob-fakturalar', moduleKey: 'invoicing' },
      { to: '/city-ledger', label: 'City Ledger', moduleKey: 'invoicing' },
      { to: '/accounting', label: 'Moliyaviy hisob', moduleKey: 'accounting' },
    ],
  },
  {
    key: 'misc',
    label: 'Boshqa',
    items: [{ to: '/pos', label: 'POS', moduleKey: 'pos' }],
  },
  {
    key: 'reports',
    label: 'Hisobotlar',
    items: [
      { to: '/segment-reports', label: 'Daromad tahlili', moduleKey: 'reports' },
      { to: '/guest-registration-report', label: "Ro'yxatga olish hisoboti", moduleKey: 'reports' },
    ],
  },
];

// Hamburger orqali ochiladigan "Administratsiya" menyusi (OPERA'da ham
// Xodimlar/Ish haqi/Rollar shu tarzda asosiy modul panelidan alohida,
// hamburger ichida joylashgan). Davomat (Payroll bilan bir xil moduleKey —
// soatlarni Payroll o'qiydi) va Obuna/to'lovlar (tenant'ning o'z SaaS
// obunasi, mehmonxona moliyaviy hisobotlaridan farqli — hisob boshqaruvi
// tusidagi narsa) ham shu yerga, HR/administrativ guruhga qo'shildi.
const ADMIN_ITEMS: LeafNavItem[] = [
  {
    to: '/property-settings',
    label: 'Mehmonxona sozlamalari',
    moduleKey: 'tenant_settings',
  },
  { to: '/staff', label: 'Xodimlar' },
  { to: '/payroll', label: 'Ish haqi', moduleKey: 'payroll' },
  { to: '/attendance', label: "Davomat va ta'til", moduleKey: 'payroll' },
  { to: '/billing', label: "Obuna va to'lovlar", moduleKey: 'billing' },
];
const ROLES_ITEM: LeafNavItem = { to: '/staff?tab=roles', label: 'Rollarni boshqarish', moduleKey: 'users_roles' };

// Hamburger-menyuning ochiq/yopiqligi ham module-dropdown'lar bilan bir xil
// `openGroup` holatida saqlanadi — shu sentinel-kalit ostida.
const ADMIN_MENU_KEY = '__admin__';

// Dropdown-guruh tugmasi uchun pastga qaragan strelka — ochiq holatda 180°
// aylanib, yuqoriga qaraydi (odatiy "dropdown ochiq" ishorasi).
function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l6 6 6-6" />
    </svg>
  );
}

// Ikkinchi darajali flyout-guruh (masalan "Profillar") uchun — OPERA
// Cloud'dagi kabi o'ngga qaragan strelka, guruh yana o'ngga ochilishini
// bildiradi (2026-09, foydalanuvchi fikri: "ko'rsatgich ham o'ngda turibdi").
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4l6 6-6 6" />
    </svg>
  );
}

function isRouteActive(pathname: string, to: string) {
  const path = to.split('?')[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Mehmonxonaning o'zi hali haqiqiy logotip-rasm yuklamagan (bazada bunday
// maydon yo'q) — vaqtinchalik o'rniga nomining bosh harfi bilan piktogramma
// ko'rsatiladi (2026-09, foydalanuvchi fikri: hamburger o'rnida hotel
// logosi bo'lsin). Haqiqiy logo-yuklash funksiyasi keyingi bosqich.
function propertyInitial(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed[0].toUpperCase() : 'F';
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
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

// Platforma admin uchun "/admin" ga qaytish havolasi (sayqal auditi: AdminPage
// ilova ichida hech qanday navigatsiya havolasi bilan bog'lanmagan edi). Login
// paytida platforma admin to'g'ridan-to'g'ri /admin'ga yo'naltiriladi, lekin
// keyinchalik boshqa (tenant) sahifaga o'tib qolsa, qaytish yo'li bo'lishi kerak.
function AdminShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5l6 2.2v4.3c0 4-2.6 6.9-6 8.5-3.4-1.6-6-4.5-6-8.5V4.7l6-2.2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.2 10l1.9 1.9L12.8 8" />
    </svg>
  );
}

// Breadcrumb qatoridagi "Bosh sahifaga qaytish" havolasi uchun (2026-09,
// OPERA Cloud'dagi "< Back to Dashboard" uslubiga moslab).
function BackArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 4.5L6.5 10l6 5.5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="10" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.6 7.6a2.4 2.4 0 1 1 3.5 2.14c-.68.37-1.1.8-1.1 1.56v.3" />
      <circle cx="10" cy="14" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth={1.2} />
    </svg>
  );
}

const WEEKDAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

// OPERA'dagi yuqori panelda ko'rsatilgan "Thursday, 03 Sep, 2026" uslubidagi
// sana — property'ning joriy moliyaviy kuni (Kunni yopish moduli shu qiymatni
// yuritadi), taqvim sanasidan farq qilishi mumkin (audit hali yopilmagan bo'lsa).
function formatBusinessDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const { dayMonth } = formatDayLabel(isoDate);
  return `${WEEKDAY_FULL[date.getDay()]}, ${dayMonth}, ${y}`;
}

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, property, logout, can } = useAuth();
  const location = useLocation();

  // Brauzer tab sarlavhasi: har bir sahifa AppLayout'ga o'z `title` propini
  // uzatadi — shu qiymatdan foydalanib sarlavhani markazlashtirib qo'yamiz,
  // alohida sahifalarga qo'lda tegish shart emas.
  useEffect(() => {
    document.title = `Folio One | ${title}`;
  }, [title]);

  // Mazmuniy guruhlash: har bir bo'lim ruxsatga ega item'largagina
  // filtrlanadi; hech narsa qolmasa, butun bo'lim yashiriladi. `children`li
  // item'larda (masalan "Profillar") ruxsat ichki link'lar darajasida
  // tekshiriladi — bironta ham ko'rinmasa, guruhning o'zi yashiriladi.
  const filterNavItems = (items: NavItem[]): NavItem[] =>
    items
      .map((item) => (item.children ? { ...item, children: filterNavItems(item.children) } : item))
      .filter((item) => (item.children ? item.children.length > 0 : !item.moduleKey || can(item.moduleKey, 'view')));

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: filterNavItems(section.items),
  })).filter((section) => section.items.length > 0);

  const activeGroupKey =
    visibleSections.find((section) =>
      flattenNavItems(section.items).some((item) => item.to && isRouteActive(location.pathname, item.to)),
    )?.key ?? null;

  // "Xodimlar" moduleKey'siz — StaffPage'ning o'zi (avvalgi Sozlamalar/gear
  // tugmasidagi kabi) barcha tizimga kirgan foydalanuvchilarga ochiq, faqat
  // tahrirlash amallari `can('users_roles', ...)` bilan cheklangan.
  const visibleAdminItems = ADMIN_ITEMS.filter((item) => !item.moduleKey || can(item.moduleKey, 'view'));
  const showRolesItem = !ROLES_ITEM.moduleKey || can(ROLES_ITEM.moduleKey, 'view');
  const hasAdminMenu = visibleAdminItems.length > 0 || showRolesItem;
  const adminMenuActive =
    visibleAdminItems.some((item) => isRouteActive(location.pathname, item.to)) ||
    (showRolesItem && isRouteActive(location.pathname, ROLES_ITEM.to));

  // Breadcrumb (2026-09, foydalanuvchi fikri — OPERA Cloud'dagi
  // "Dashboard / Client Relations / Profiles / Manage Profile" +
  // "< Back to Dashboard" uslubi): sahifa sarlavhasi endi ortiqcha joy
  // egallamasligi uchun kichraytirildi, o'rniga shu ingichka trail
  // qo'shildi. Bosh sahifaning o'zida ko'rsatilmaydi (u yerda "orqaga"
  // degan narsa mazmunsiz).
  const isDashboard = location.pathname === '/' || location.pathname.startsWith('/dashboard');
  const activeSection = visibleSections.find((section) =>
    flattenNavItems(section.items).some((item) => item.to && isRouteActive(location.pathname, item.to)),
  );
  const breadcrumbSectionLabel = activeSection?.label ?? (adminMenuActive ? 'Administratsiya' : null);

  // Yuqori gorizontal panel: faqat bitta dropdown (modul guruhi yoki
  // Administratsiya menyusi) bir vaqtda ochiq bo'lishi mumkin, bosilganda
  // ochiladi/yopiladi (hover emas). Sahifadan tashqariga bosilganda
  // (quyidagi shaffof overlay orqali) avtomatik yopiladi.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => (prev === key ? null : key));
  };
  // Ikkinchi darajali flyout ("Profillar" kabi) — dropdown ichida hover
  // orqali ochiladi, OPERA Cloud'dagi kabi (2026-09, foydalanuvchi fikri).
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const closeGroup = () => {
    setOpenGroup(null);
    setOpenSubmenu(null);
  };

  // Mobil/planshetda (`lg:`dan tor) gorizontal panel o'rniga hamburger orqali
  // ochiladigan to'liq-kenglikdagi ochiladigan menyu ishlatiladi (barcha
  // modullar + Administratsiya + Rollarni boshqarish bitta ro'yxatda, chunki
  // mobilda alohida modul-panel yo'q). Har bir sahifa o'z AppLayout nusxasini
  // alohida mount qiladi, shuning uchun bu holat sahifalar orasida
  // saqlanmaydi — har doim yopiq holatda boshlanadi, bu ochiladigan menyu
  // uchun kutilgan xatti-harakat.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Sahifa (route) o'zgarganda ochiq dropdown/mobil-menyu avtomatik yopiladi
  // (masalan brauzerning orqaga/oldinga tugmasi bilan navigatsiya qilinganda).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    closeGroup();
    closeMobileMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Eng tepadagi ingichka oltin chiziq (2026-09, OPERA Cloud
          referensiga ko'ra) — sahifaning eng yuqori chetida, navy panelidan
          ham yuqorida, brend rangimizni darhol ko'rsatadigan aksent. */}
      <div className="h-1.5 bg-brand-gold shrink-0" aria-hidden="true" />
      {/* Yuqori panel: mehmonxonaning o'z belgisi/nomi, moliyaviy sana, foydalanuvchi, menyular.
          2026-09 (uslub yangilanishi): fon endi neytral kulrang o'rniga
          brend rangi (`bg-brand-navy`) — Login sahifasida ishlatiladigan
          xuddi shu rang, butun ilova bo'ylab izchil brend identifikatsiyasi
          uchun. Icon-tugmalar endi `rounded-full` (Login'dagi pill/yumaloq
          uslubga mos), oldingi to'rtburchak `rounded` o'rniga.
          2026-09 (qayta joylashtirish, foydalanuvchi fikri): hamburgerlar
          (mobil to'liq-menyu va desktop Administratsiya) chap chetdan
          Yordam belgisidan keyinga, o'ng tomonga ko'chirildi. Ularning
          o'rnida endi mehmonxonaning o'z belgi-piktogrammasi (pastga
          qarang, propertyInitial) ko'rsatiladi. */}
      <header className="relative z-30 shrink-0 bg-brand-navy text-white flex items-center justify-between pl-3 pr-5 py-[5px] shadow-[0_2px_6px_rgba(15,23,42,0.25)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mehmonxonaning o'z logotipi (2026-09-04, "Mehmonxona
              sozlamalari" sahifasidan yuklanadi). Yuklanmagan bo'lsa —
              avvalgidek nomining bosh harfi bilan piktogramma. Ikkala
              holatda ham o'lcham bir xil, ya'ni panel balandligi
              o'zgarmaydi (u navigatsiya qatori bilan tenglashtirilgan). */}
          {property?.logoUrl ? (
            <img
              src={property.logoUrl}
              alt=""
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-md bg-white object-contain"
            />
          ) : (
            <span
              className="flex items-center justify-center h-6 w-6 rounded-md bg-white text-brand-navy text-[11px] font-bold shrink-0"
              aria-hidden="true"
            >
              {propertyInitial(property?.name)}
            </span>
          )}
          {/* Mehmonxonaning o'z nomi (OPERA'da ham yuqori panelda PMS logotipi
              o'rniga mulkning o'z brendi ko'rsatiladi — Folio One logotipi esa
              pastdagi modul panelining chetida, quyiga qarang). */}
          <p className="text-sm font-semibold truncate">{property?.name ?? 'Folio One'}</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {property && (
            <>
              <p className="hidden sm:block text-xs text-white/80">{formatBusinessDate(property.businessDate)}</p>
              {/* OPERA'dagi kabi bo'limlar orasidagi ingichka ajratuvchi chiziq */}
              <span className="hidden sm:block h-5 w-px bg-white/25" aria-hidden="true" />
            </>
          )}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-white/80 min-w-0">
            <UserIcon />
            <span className="truncate max-w-[160px]">{user?.fullName || user?.email}</span>
          </div>
          <span className="hidden md:block h-5 w-px bg-white/25" aria-hidden="true" />
          <Link
            to="/help"
            aria-label="Yordam"
            title="Yordam"
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <HelpIcon />
          </Link>
          {/* Yordam va hamburger(lar) orasidagi ajratuvchi (2026-09,
              foydalanuvchi fikri) — yuqoridagi bo'limlar orasidagi xuddi shu
              uslub. */}
          <span className="hidden sm:block h-5 w-px bg-white/25" aria-hidden="true" />
          {/* Mobilda (`lg:`dan tor) hamburger — barcha modullar + Administratsiya
              bitta to'liq ro'yxatli ochiladigan menyuni boshqaradi. */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
            title={mobileMenuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors lg:hidden"
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
          {/* Desktopda (`lg:`+) xuddi shu joydagi hamburger endi faqat
              "Administratsiya" + "Rollarni boshqarish" dropdown'ini ochadi —
              oddiy modullar allaqachon pastdagi gorizontal panelda ko'rinadi
              (OPERA'da ham xuddi shunday: hamburger = administrativ menyu). */}
          {hasAdminMenu && (
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => toggleGroup(ADMIN_MENU_KEY)}
                aria-label="Administratsiya menyusi"
                title="Administratsiya menyusi"
                aria-expanded={openGroup === ADMIN_MENU_KEY}
                className={`p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors ${
                  openGroup === ADMIN_MENU_KEY ? 'bg-white/10 text-white' : ''
                } ${adminMenuActive ? 'text-brand-gold' : ''}`}
              >
                <HamburgerIcon />
              </button>
              {openGroup === ADMIN_MENU_KEY && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-2xl border border-slate-200 bg-white py-1.5 text-left shadow-lg overflow-hidden">
                  {visibleAdminItems.length > 0 && (
                    <>
                      <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Administratsiya
                      </p>
                      {visibleAdminItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={closeGroup}
                          className={({ isActive }) =>
                            `block px-4 py-2 text-sm whitespace-nowrap ${
                              isActive
                                ? 'bg-brand-navy-light text-brand-navy font-semibold'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </>
                  )}
                  {showRolesItem && (
                    <>
                      {visibleAdminItems.length > 0 && <div className="my-1 border-t border-slate-100" />}
                      <NavLink
                        to={ROLES_ITEM.to}
                        onClick={closeGroup}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm whitespace-nowrap ${
                            isActive
                              ? 'bg-brand-navy-light text-brand-navy font-semibold'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'
                          }`
                        }
                      >
                        {ROLES_ITEM.label}
                      </NavLink>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {user?.isPlatformAdmin && (
            <Link
              to="/admin"
              aria-label="Platforma boshqaruvi"
              title="Platforma boshqaruvi"
              className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <AdminShieldIcon />
            </Link>
          )}
        </div>
      </header>

      {/* Yuqori gorizontal modul-panel (faqat desktop, `lg:`+): chapda F1
          logotipi (Bosh sahifa), keyin har bir mazmuniy guruh bosilganda
          dropdown sifatida ochiladi.
          Uslub: Login sahifasidagi pill tugmalar/inputlarga mos yumaloq
          (`rounded-full`) chip'lar — faol/hover holatida orqa fon bilan
          ajratiladi, chiziq bilan emas (qarang index.css `.chip-active`).
          Endi butun ilovadagi barcha tab-qatorlar shu uslubda.
          2026-09-04: navy header bilan orasida gold chiziq emas, SOYA
          ajratib turadi (`shadow-[...]` + `z-20`, header esa `z-30` —
          soya ko'rinishi uchun stacking tartibi shart). Panel balandligi
          navy header bilan KO'RINISHDA teng bo'lishi uchun undan biroz
          kattaroq (41px va 37px) — ustki qismini header soyasi qoplaydi. */}
      <nav className="hidden lg:flex flex-wrap items-center gap-1 shrink-0 bg-white border-b border-slate-200 px-3 py-1.5 relative z-20 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
        {/* F1 logotipi — nav panelining brend belgisi (2026-09, qayta ko'rib
            chiqildi: 3D/soyali uslub olib tashlandi, o'rniga faqat o'lcham
            (h-12, avvalgi h-11'dan biroz kattaroq) va negative-margin
            (`-my-3`) orqali panelning yuqori (header bilan chegara) va
            pastki (kontent bilan chegara) chiziqlaridan "yirib chiqadigan"
            vizual salmoq — Windows 7 Start tugmasi taassurotiga yaqinroq,
            lekin gradient/gloss/bevel'siz, qarang index.css .f1-brand-mark). */}
        <Link to="/dashboard" aria-label="Bosh sahifa" title="Bosh sahifa" className="shrink-0 -my-3">
          <span className="f1-brand-mark">
            <img src={folioOneLogo} alt="" className="h-9 w-9" />
          </span>
        </Link>
        {/* Nozik ajratuvchi — yuqoridagi header'dagi sana/user/? oralig'idagi
            chiziqlar bilan bir xil uslub (h-5 w-px), faqat oq fonga moslab
            rangi bg-slate-200 (2026-09, foydalanuvchi fikri). */}
        <span className="mr-2 h-5 w-px bg-slate-200" aria-hidden="true" />
        {visibleSections.map((section) =>
          section.label ? (
            <div key={section.key} className="relative">
              <button
                type="button"
                onClick={() => toggleGroup(section.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-1 text-sm font-medium rounded-full transition-colors ${
                  activeGroupKey === section.key
                    ? 'chip-active'
                    : `text-slate-700 hover:text-brand-navy hover:bg-brand-navy-light ${
                        openGroup === section.key ? 'bg-brand-navy-light text-brand-navy' : ''
                      }`
                }`}
                aria-expanded={openGroup === section.key}
              >
                <span>{section.label}</span>
                <ChevronDownIcon open={openGroup === section.key} />
              </button>
              {openGroup === section.key && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-2xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  {section.items.map((item) =>
                    item.children ? (
                      <div
                        key={item.label}
                        className="relative"
                        onMouseEnter={() => setOpenSubmenu(item.label)}
                        onMouseLeave={() => setOpenSubmenu(null)}
                      >
                        <div
                          className={`flex items-center justify-between gap-3 px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                            openSubmenu === item.label
                              ? 'bg-slate-50 text-brand-navy'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'
                          }`}
                        >
                          <span>{item.label}</span>
                          <ChevronRightIcon />
                        </div>
                        {/* Ikkinchi darajali flyout — OPERA Cloud'dagi kabi
                            o'ngga, birinchi darajali panel bilan bir xil
                            balandlikda (top-0) ochiladi. */}
                        {openSubmenu === item.label && (
                          <div className="absolute left-full top-0 z-50 ml-1 min-w-[220px] rounded-2xl border border-slate-200 bg-white py-1.5 shadow-lg">
                            {item.children.map((child) => (
                              <NavLink
                                key={child.to}
                                to={child.to!}
                                onClick={closeGroup}
                                className={({ isActive }) =>
                                  `block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                                    isActive
                                      ? 'bg-brand-navy-light text-brand-navy font-semibold'
                                      : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'
                                  }`
                                }
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <NavLink
                        key={item.to}
                        to={item.to!}
                        onClick={closeGroup}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                            isActive
                              ? 'bg-brand-navy-light text-brand-navy font-semibold'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ),
                  )}
                </div>
              )}
            </div>
          ) : (
            section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to!}
                className={({ isActive }) =>
                  `flex items-center whitespace-nowrap px-4 py-1 text-sm font-medium rounded-full transition-colors ${
                    isActive ? 'chip-active' : 'text-slate-700 hover:text-brand-navy hover:bg-brand-navy-light'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))
          ),
        )}
      </nav>
      {/* Dropdown ochiq bo'lganda, undan tashqariga bosilsa yopish uchun
          shaffof overlay (dropdown panelining o'zi undan yuqori z-index'da). */}
      {openGroup && <div className="fixed inset-0 z-10" onClick={closeGroup} aria-hidden="true" />}

      {/* Mobil/planshetda (`lg:`dan tor) hamburger orqali ochiladigan to'liq
          ro'yxat — desktopdagi dropdown'lardan farqli, hammasi bir vaqtda
          ko'rinadi (accordion emas), chunki bu vaqtinchalik ochiladigan
          menyu, doimiy sidebar emas. Administratsiya + Rollarni boshqarish
          ham shu ro'yxat oxirida, chunki mobilda alohida hamburger-dropdown
          yo'q (bitta hamburger — bitta to'liq menyu). */}
      {mobileMenuOpen && (
        <>
          <div className="fixed left-0 right-0 top-14 bottom-0 z-30 bg-slate-900/40 lg:hidden" onClick={closeMobileMenu} aria-hidden="true" />
          <div className="lg:hidden fixed left-0 right-0 top-14 z-40 max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-white border-b border-slate-200 shadow-lg">
            <nav className="px-3 py-2">
              {visibleSections.map((section) => (
                <div key={section.key} className="py-1">
                  {section.label && (
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {section.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) =>
                      item.children ? (
                        // Mobilda flyout kerak emas (menyu allaqachon to'liq
                        // ochiq ro'yxat) — "Profillar" shunchaki kichik
                        // sarlavha, farzand-item'lar bevosita ostida.
                        <div key={item.label}>
                          <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium text-slate-400">{item.label}</p>
                          {item.children.map((child) => (
                            <NavLink
                              key={child.to}
                              to={child.to!}
                              onClick={closeMobileMenu}
                              className={({ isActive }) =>
                                `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                  isActive
                                    ? 'chip-active'
                                    : 'text-slate-700 hover:bg-brand-navy-light hover:text-brand-navy'
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      ) : (
                        <NavLink
                          key={item.to}
                          to={item.to!}
                          onClick={closeMobileMenu}
                          className={({ isActive }) =>
                            `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? 'chip-active'
                                : 'text-slate-700 hover:bg-brand-navy-light hover:text-brand-navy'
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ),
                    )}
                  </div>
                </div>
              ))}
              {hasAdminMenu && (
                <div className="py-1 border-t border-slate-100 mt-1">
                  {visibleAdminItems.length > 0 && (
                    <>
                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Administratsiya
                      </p>
                      <div className="space-y-0.5">
                        {visibleAdminItems.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={closeMobileMenu}
                            className={({ isActive }) =>
                              `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                isActive
                                  ? 'chip-active'
                                  : 'text-slate-700 hover:bg-brand-navy-light hover:text-brand-navy'
                              }`
                            }
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    </>
                  )}
                  {showRolesItem && (
                    <div className="space-y-0.5 mt-0.5">
                      <NavLink
                        to={ROLES_ITEM.to}
                        onClick={closeMobileMenu}
                        className={({ isActive }) =>
                          `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'chip-active'
                              : 'text-slate-700 hover:bg-brand-navy-light hover:text-brand-navy'
                          }`
                        }
                      >
                        {ROLES_ITEM.label}
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-slate-100 mt-2 px-3 py-3">
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                <button onClick={logout} className="mt-1 text-xs text-slate-600 hover:text-brand-navy underline">
                  Chiqish
                </button>
              </div>
            </nav>
          </div>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 2026-09 (breadcrumb qo'shildi, foydalanuvchi fikri): sahifa
            sarlavhasi endi qayta text-lg'ga kichraytirildi (avvalgi
            "yakuniy sayqal" bosqichida text-xl'ga oshirilgan edi) — "qayerda
            turgan bo'lsang, o'sha joy nomi juda katta joy egallab turibdi"
            degan izohga javoban. O'rniga ustida ingichka breadcrumb trail +
            "Bosh sahifaga qaytish" havolasi (OPERA Cloud uslubida) — "qayerda
            ekanligimiz" haqidagi ma'lumot endi og'ir sarlavha emas, yengil
            trail orqali beriladi. Bosh sahifaning o'zida ko'rsatilmaydi. */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 py-3">
          {!isDashboard && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                {/* 2026-09 (foydalanuvchi fikri): "Bosh sahifa" endi havola
                    emas, oddiy matn — o'ng tarafdagi "Bosh sahifaga qaytish"
                    havolasi buning uchun allaqachon yetarli, ikkalasini ham
                    bosiladigan qilish ortiqcha edi. */}
                <span className="shrink-0">Bosh sahifa</span>
                {breadcrumbSectionLabel && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="shrink-0">{breadcrumbSectionLabel}</span>
                  </>
                )}
                <span aria-hidden="true">/</span>
                <span className="truncate font-medium text-slate-600">{title}</span>
              </nav>
              <Link
                to="/dashboard"
                className="flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-brand-navy hover:underline"
              >
                <BackArrowIcon />
                Bosh sahifaga qaytish
              </Link>
            </div>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <SampleDataBanner />
          {children}
        </main>
      </div>

      {/* Pastki footer — OPERA'dagi "Oracle Hospitality | Copyright..." panelining Folio One versiyasi */}
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
