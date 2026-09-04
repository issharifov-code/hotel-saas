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
      // Budjet (oylik reja) ham ACCOUNTING ruxsatiga bog'liq — u
      // mehmonxonaning moliyaviy maqsadlari, front-desk uchun mo'ljallanmagan.
      { to: '/budget', label: 'Budjet', moduleKey: 'accounting' },
    ],
  },
  // 2026-09-04 (foydalanuvchi qarori): HR/xodimlar bo'limi hamburgerdan shu
  // yerga ko'chirildi. Hamburger endi faqat SOZLAMA tusidagi narsalar uchun
  // (mehmonxona sozlamalari, rollar, obuna) — xodimlar, ish haqi va davomat
  // esa kundalik operatsion ish, ya'ni ularning joyi modul panelida.
  {
    key: 'hr',
    label: 'Xodimlar',
    items: [
      // `moduleKey` yo'q — StaffPage barcha tizimga kirgan xodimlarga ochiq,
      // faqat tahrirlash amallari `can('users_roles', ...)` bilan cheklangan
      // (bu qoida hamburgerda ham shunday edi, o'zgarmadi).
      { to: '/staff', label: 'Xodimlar' },
      { to: '/payroll', label: 'Ish haqi', moduleKey: 'payroll' },
      // Davomat Payroll bilan bir xil moduleKey'da — soatlarni Payroll o'qiydi.
      { to: '/attendance', label: "Davomat va ta'til", moduleKey: 'payroll' },
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

// Chap paneldagi (hamburger) "Administratsiya" ro'yxati.
//
// 🔴 QAMROV (2026-09-04, foydalanuvchi qarori): bu yerda FAQAT sozlama/
// boshqaruv tusidagi narsalar turadi — kundalik ishda kunda ochilmaydigan,
// "tizimni sozlash" ma'nosidagilar. Kundalik operatsion sahifalar
// (xodimlar, ish haqi, davomat) modul paneliga ko'chirildi.
//
// Obuna va to'lovlar shu yerda qoldi: u mehmonxonaning moliyaviy
// hisobotlari emas, tenant'ning O'Z SaaS obunasi — ya'ni hisob boshqaruvi.
const ADMIN_ITEMS: LeafNavItem[] = [
  {
    to: '/property-settings',
    label: 'Mehmonxona sozlamalari',
    moduleKey: 'tenant_settings',
  },
  { to: '/billing', label: "Obuna va to'lovlar", moduleKey: 'billing' },
];
const ROLES_ITEM: LeafNavItem = { to: '/staff?tab=roles', label: 'Rollarni boshqarish', moduleKey: 'users_roles' };

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

// Chap paneldagi havolalar uchun umumiy uslub. Panel foni yengil "soft
// white" (`bg-slate-50` — ilovaning kontent foni bilan bir xil; 2026-09-04
// foydalanuvchi fikri: avval to'q ko'k, keyin och ko'k gradient sinaldi,
// ikkalasi ham og'ir chiqdi). Matn qorong'i, faol element esa ilovaning
// odatiy `.chip-active` uslubida — butun ilova bo'ylab izchil.
// 🔴 RANG QOIDASI (2026-09-04, foydalanuvchi qarori) — butun ilova uchun:
//   BOSILADIGAN yozuv  -> brend ko'k (`text-brand-navy`)
//   BOSIB BO'LMAYDIGAN -> qora (`text-slate-900`)
// Ya'ni ko'k rang endi "buni bosish mumkin" degan YAGONA signal. Shuning
// uchun oddiy matnga hech qachon navy berilmaydi va havolalar kulrang
// qoldirilmaydi.
function drawerLinkClass(isActive: boolean): string {
  const base = 'block rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  return isActive
    ? `${base} chip-active`
    : `${base} text-brand-navy hover:bg-brand-navy-light`;
}

// 2026-09-04 (foydalanuvchi fikri, OPERA Cloud referensi): chiziqlar
// sezilarli darajada uzunroq va qalinroq — OPERA'dagi hamburger ham keng,
// "bosiladigan blok" taassurotini beradi. viewBox 28x20 (kvadrat emas),
// shuning uchun `w-7 h-5`: aks holda chiziqlar cho'zilib ketardi.
function HamburgerIcon() {
  return (
    <svg viewBox="0 0 28 20" className="h-5 w-7" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" d="M2 4h24M2 10h24M2 16h24" />
    </svg>
  );
}

// Hamburger bilan ALMASHADI, shuning uchun o'lchami ham u bilan bir xil —
// aks holda panel ochilganda tugma ichidagi belgi sakrab ketardi.
function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2}>
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

  // Chapdan surilib ochiladigan panel (2026-09-04, OPERA Cloud referensi).
  // BARCHA ekran o'lchamlarida bitta xil panel: mobilda u yagona navigatsiya
  // yo'li, desktopda esa modul paneliga qo'shimcha "site map" (OPERA'da ham
  // shunday — gorizontal menyu bor bo'lsa ham hamburger to'liq ro'yxatni
  // ochadi). Ichida modullar + Administratsiya + Rollarni boshqarish.
  //
  // Har bir sahifa o'z AppLayout nusxasini alohida mount qiladi, shuning
  // uchun bu holat sahifalar orasida saqlanmaydi — har doim yopiq holatda
  // boshlanadi, ochiladigan menyu uchun kutilgan xatti-harakat.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  // Kontentni surish faqat keng ekranda (Tailwind `lg` = 64rem). Inline
  // style'da media query ishlatib bo'lmagani uchun buni JS kuzatadi.
  const [isWideScreen, setIsWideScreen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 64rem)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 64rem)');
    const onChange = () => setIsWideScreen(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Escape bilan yopish — panel butun ekranni egallaganda klaviatura orqali
  // chiqish yo'li bo'lishi kerak.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Sahifa (route) o'zgarganda ochiq dropdown/mobil-menyu avtomatik yopiladi
  // (masalan brauzerning orqaga/oldinga tugmasi bilan navigatsiya qilinganda).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    closeGroup();
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="h-screen bg-slate-50 overflow-hidden">
      {/* Panel ochilganda butun ilova o'ngga suriladi (2026-09-04,
          foydalanuvchi fikri: "navigatsiya paneli orqasida to'silib
          qolmasin, o'ngga surilsin") — panel kontent USTIGA chiqmaydi,
          uni itaradi.

          Faqat `lg:`+ da: 390px enli telefonda 300px surish deyarli hech
          narsa qoldirmaydi, shuning uchun u yerda panel odatdagidek
          ustidan ochiladi (qorong'ilashtiruvchi qatlam bilan).

          🔴 Panelning O'ZI shu konteynerdan TASHQARIDA turishi SHART:
          `transform` qo'llangan element o'zining `position: fixed`
          farzandlari uchun yangi containing block yaratadi, ya'ni panel
          ham u bilan birga surilib ketardi. */}
      <div
        className="flex h-full flex-col"
        // 🔴 NIMA UCHUN INLINE STYLE, CSS klassi emas (2026-09-04):
        // avval `lg:translate-x-[300px]` (Tailwind utility) va keyin qo'lda
        // yozilgan `.app-shell-pushed` klassi sinaldi — IKKALASI HAM
        // production'da ishlamadi: aynan shu elementda `transform` identity
        // (0px) bo'lib qolardi, holbuki AYNAN SHU klasslar bilan yaratilgan
        // sinov elementi 300px ni to'g'ri olardi. Sabab jonli saytda ham
        // aniqlanmadi (kaskadda `transform` qo'yadigan boshqa mos qoida
        // topilmadi). Inline style stylesheet'dagi har qanday qoidadan
        // ustun, shuning uchun bu yerda u yagona ishonchli yo'l.
        //
        // `isWideScreen` kerak, chunki inline style'da media query bo'lmaydi:
        // tor ekranda panel kontent USTIDAN ochiladi (300px surish 390px
        // ekranda hech narsa qoldirmasdi).
        style={{
          transform: drawerOpen && isWideScreen ? 'translateX(300px)' : 'translateX(0)',
          transition: 'transform 300ms cubic-bezier(0, 0, 0.2, 1)',
        }}
      >
      {/* Eng tepadagi ingichka oltin chiziq (2026-09, OPERA Cloud
          referensiga ko'ra) — sahifaning eng yuqori chetida, navy panelidan
          ham yuqorida, brend rangimizni darhol ko'rsatadigan aksent. */}
      <div className="h-[7.62px] bg-brand-gold shrink-0" aria-hidden="true" />
      {/* Yuqori panel: mehmonxonaning o'z belgisi/nomi, moliyaviy sana, foydalanuvchi, menyular.
          2026-09 (uslub yangilanishi): fon endi neytral kulrang o'rniga
          brend rangi (`bg-brand-navy`) — Login sahifasida ishlatiladigan
          xuddi shu rang, butun ilova bo'ylab izchil brend identifikatsiyasi
          uchun. Icon-tugmalar endi `rounded-full` (Login'dagi pill/yumaloq
          uslubga mos), oldingi to'rtburchak `rounded` o'rniga.
          2026-09-04 (foydalanuvchi fikri, OPERA Cloud referensi): endi
          BITTA hamburger bor va u eng CHAP burchakda, mehmonxona
          belgisidan ham oldin — bosilganda chapdan to'liq balandlikdagi
          panel surilib ochiladi (pastga qarang, `drawerOpen`). Avval
          o'ng tomonda ikkita alohida hamburger bor edi (mobil to'liq
          menyu + desktop "Administratsiya" dropdown'i); ikkalasi ham shu
          bitta chap panelga birlashtirildi.

          Balandlik (2026-09-04): oltin chiziq + navy panel jufti
          foydalanuvchi so'roviga ko'ra 27% ga kengaytirildi (42px -> 53.34px),
          ikkisining nisbati (1:6) o'zgarmagan holda: 6->7.62px va
          36->45.72px. Balandlik `py-` orqali emas, aniq `h-[...]` bilan
          berilgan — shunda ichki elementlar o'zgarsa ham panel balandligi
          siljimaydi. */}
      <header className="relative z-30 shrink-0 bg-brand-navy text-white flex items-center justify-between pl-3 pr-5 h-[45.72px] shadow-[0_2px_6px_rgba(15,23,42,0.25)]">
        {/* 🔴 Chap tomonning o'lchamlari pastdagi modul paneli bilan
            QAT'IY bog'langan (2026-09-04, foydalanuvchi fikri: "hamburger
            olgan joy pastidagi F1 olgan joy bilan teng bo'lsin, ajratuvchisi
            bir joyda bo'lsin"):
              pl-3 (12px) + uya 60.96px + 4px  =  ajratuvchi 76.96px da
            Pastdagi panelda ham xuddi shu: px-3 (12px) + F1 belgisi
            60.96px + gap-1 (4px). Shuning uchun `gap-2.5` o'rniga bu
            yerda oraliqlar QO'LDA beriladi — flex gap ikkalasini birdek
            ushlab turolmasdi. Uya eni o'zgarsa, `.f1-brand-mark` ham shu
            qiymatda o'zgarishi shart (index.css). */}
        <div className="flex items-center min-w-0">
          {/* Chapdagi yagona hamburger (2026-09-04) — OPERA Cloud'dagi kabi
              eng chap burchakda, mehmonxona belgisidan oldin. Bosilganda
              chapdan to'liq balandlikdagi panel surilib ochiladi. */}
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={drawerOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
            title={drawerOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
            aria-expanded={drawerOpen}
            aria-controls="app-drawer"
            className="flex w-[60.96px] shrink-0 items-center justify-center rounded-full py-1.5 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
          >
            {drawerOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
          <span className="ml-1 mr-2.5 h-5 w-px bg-white/25 shrink-0" aria-hidden="true" />
          {/* Mehmonxonaning o'z logotipi (2026-09-04, "Mehmonxona
              sozlamalari" sahifasidan yuklanadi). Yuklanmagan bo'lsa —
              avvalgidek nomining bosh harfi bilan piktogramma. Ikkala
              holatda ham o'lcham bir xil, ya'ni panel balandligi
              o'zgarmaydi (u navigatsiya qatori bilan tenglashtirilgan). */}
          <span className="flex min-w-0 items-center gap-2.5">
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
          </span>
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
          kattaroq — ustki qismini header soyasi qoplaydi.
          2026-09-04: bu qator ham 27% ga kengaytirildi (41px -> 52.07px).
          `min-h-` ishlatilgan, `h-` emas: panelda `flex-wrap` bor, ya'ni
          tor ekranda item'lar ikkinchi qatorga tushishi mumkin — qat'iy
          balandlik ularni kesib qo'yardi. */}
      <nav className="hidden lg:flex flex-wrap items-center gap-1 shrink-0 bg-white border-b border-slate-200 px-3 py-1.5 min-h-[52.07px] relative z-20 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
        {/* F1 logotipi — nav panelining brend belgisi (2026-09, qayta ko'rib
            chiqildi: 3D/soyali uslub olib tashlandi, o'rniga faqat o'lcham
            (h-12, avvalgi h-11'dan biroz kattaroq) va negative-margin
            (`-my-3`) orqali panelning yuqori (header bilan chegara) va
            pastki (kontent bilan chegara) chiziqlaridan "yirib chiqadigan"
            vizual salmoq — Windows 7 Start tugmasi taassurotiga yaqinroq,
            lekin gradient/gloss/bevel'siz, qarang index.css .f1-brand-mark). */}
        <Link to="/dashboard" aria-label="Bosh sahifa" title="Bosh sahifa" className="shrink-0 -my-3">
          <span className="f1-brand-mark">
            <img src={folioOneLogo} alt="" className="h-[45.72px] w-[45.72px]" />
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
                // 2026-09-04 (foydalanuvchi fikri): modul nomlari endi
                // neytral kulrang emas, brend ko'kida — OPERA'da ham bu
                // qatordagi yozuvlar brend rangida turadi. Faol guruh
                // baribir ajralib turadi: `.chip-active` da halqa + yengil
                // fon bor, rang emas.
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-1 text-sm font-medium rounded-full transition-colors ${
                  activeGroupKey === section.key
                    ? 'chip-active'
                    : `text-brand-navy hover:bg-brand-navy-light ${
                        openGroup === section.key ? 'bg-brand-navy-light' : ''
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
                              : 'text-brand-navy hover:bg-slate-50'
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
                                      : 'text-brand-navy hover:bg-slate-50'
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
                              : 'text-brand-navy hover:bg-slate-50'
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
                  // Yuqoridagi guruh tugmalari bilan bir xil rang (brend ko'k).
                  `flex items-center whitespace-nowrap px-4 py-1 text-sm font-medium rounded-full transition-colors ${
                    isActive ? 'chip-active' : 'text-brand-navy hover:bg-brand-navy-light'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))
          ),
        )}
        {/* Yordam ("?") — 2026-09-04 foydalanuvchi fikri bo'yicha navy
            header'dan shu qatorga, bir pog'ona pastga tushirildi.
            `ml-auto` bilan qatorning eng o'ng chetiga tiraladi. */}
        <Link
          to="/help"
          aria-label="Yordam"
          title="Yordam"
          className="ml-auto shrink-0 rounded-full p-1.5 text-brand-navy transition-colors hover:bg-brand-navy-light"
        >
          <HelpIcon />
        </Link>
      </nav>
      {/* Dropdown ochiq bo'lganda, undan tashqariga bosilsa yopish uchun
          shaffof overlay (dropdown panelining o'zi undan yuqori z-index'da). */}
      {openGroup && <div className="fixed inset-0 z-10" onClick={closeGroup} aria-hidden="true" />}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 2026-09 (breadcrumb qo'shildi, foydalanuvchi fikri): sahifa
            sarlavhasi endi qayta text-lg'ga kichraytirildi (avvalgi
            "yakuniy sayqal" bosqichida text-xl'ga oshirilgan edi) — "qayerda
            turgan bo'lsang, o'sha joy nomi juda katta joy egallab turibdi"
            degan izohga javoban. O'rniga ustida ingichka breadcrumb trail +
            "Bosh sahifaga qaytish" havolasi (OPERA Cloud uslubida) — "qayerda
            ekanligimiz" haqidagi ma'lumot endi og'ir sarlavha emas, yengil
            trail orqali beriladi. Bosh sahifaning o'zida ko'rsatilmaydi. */}
        {/* 2026-09-04 (foydalanuvchi fikri, OPERA Cloud referensi): bu qator
            endi oq emas, pastdagi kontent bilan bir xil "chuqurlik" rangida
            (`bg-slate-50`) — OPERA'da ham breadcrumb va sahifa sarlavhasi
            kontentning o'z fonida turadi, alohida oq lenta emas. Pastdagi
            `border-b` esa endi shu ikki qatlamni ajratib turadigan yagona
            belgi (ikkalasi bir xil rangda bo'lgani uchun u zarur). */}
        <header className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-8 py-3">
          {!isDashboard && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-slate-900">
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
                <span className="truncate font-medium text-slate-900">{title}</span>
              </nav>
              <Link
                to="/dashboard"
                className="flex shrink-0 items-center gap-1 text-xs text-brand-navy hover:underline"
              >
                <BackArrowIcon />
                Bosh sahifaga qaytish
              </Link>
            </div>
          )}
          {/* 2026-09-04 (foydalanuvchi fikri, OPERA Cloud referensi): Bosh
              sahifada sarlavha endi katta h1 emas, breadcrumb bilan BIR XIL
              kichik "navigatsiya" uslubida — OPERA'da ham bu joyda faqat
              kichkina "Dashboard" turadi, sahifaning haqiqiy sarlavhasi esa
              kontent ichida ("Salom, ...!").

              Boshqa sahifalarda esa sarlavha katta qoladi: u yerda tepada
              allaqachon breadcrumb bor, ya'ni sarlavha yagona "bu qaysi
              sahifa" belgisi. `h1` semantikasi ikkala holatda ham saqlanadi
              (har sahifada bitta h1 bo'lishi kerak) — faqat uslubi farq
              qiladi. */}
          {isDashboard ? (
            <h1 className="text-xs font-medium text-slate-900">{title}</h1>
          ) : (
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          )}
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

      {/* Chapdan surilib ochiladigan panel (2026-09-04, OPERA Cloud
          referensi). Barcha ekran o'lchamlarida bir xil — mobilda yagona
          navigatsiya yo'li, desktopda modul paneliga qo'shimcha to'liq
          "site map".

          MUHIM: panel HAR DOIM DOM'da turadi va faqat `translate-x` bilan
          surilади. Shartli render (`{open && ...}`) qilinsa CSS o'tishi
          ishlamasdi — element endigina paydo bo'lgani uchun brauzerda
          animatsiya qiladigan boshlang'ich holat bo'lmaydi. Yopiq holatda
          `invisible` — u elementni tab-tartibidan ham, ekran o'quvchidan
          ham olib tashlaydi (`pointer-events-none`dan farqli). */}
      {/* Qorong'ilashtiruvchi qatlam FAQAT tor ekranlarda (`lg:`dan kichik):
          u yerda panel kontentni qoplaydi, chunki 300px surish 390px enli
          telefonda deyarli hech narsa qoldirmasdi. `lg:`+ da esa kontent
          o'ngga suriladi (yuqoriga qarang) va hech narsa qoplanmaydi —
          shuning uchun u yerda qatlam ham, qorong'ilashtirish ham yo'q. */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-300 lg:hidden ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <div
        id="app-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Asosiy menyu"
        className={`fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-r border-slate-200 bg-slate-50 text-slate-900 shadow-2xl transition-[transform,visibility] duration-300 ease-out ${
          drawerOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        {/* Panelning tepasi — yopish tugmasi header'dagi hamburger bilan
            bir xil joyda turishi uchun balandligi ham o'sha (oltin chiziq +
            navy panel = 53.34px). */}
        {/* Tepadagi bo'sh band — 2026-09-04 foydalanuvchi fikri bo'yicha bu
            yerdagi "Folio One" brendi olib tashlandi (u allaqachon pastdagi
            modul panelida bor, takrorlash ortiqcha edi). Band esa QOLDI:
            balandligi oltin chiziq + navy header bilan teng (53.34px), ya'ni
            paneldagi ro'yxat kontent bilan bir chiziqdan boshlanadi.

            Yopish tugmasi faqat tor ekranlarda: u yerda panel header'ni
            qoplaydi va undagi hamburgerga yetib bo'lmaydi. `lg:`+ da kontent
            o'ngga surilgani uchun header'dagi tugma ko'rinib turadi va yagona
            almashtirgich bo'lib qoladi. */}
        <div className="flex h-[53.34px] shrink-0 items-center border-b border-slate-200 pl-3 pr-3 pt-[7.62px]">
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Menyuni yopish"
            title="Menyuni yopish"
            className="flex w-[60.96px] shrink-0 items-center justify-center rounded-full py-1.5 text-brand-navy transition-colors hover:bg-brand-navy-light lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {/* 🔴 Modul bo'limlari panelda FAQAT tor ekranda ko'rinadi
              (2026-09-04, foydalanuvchi qarori): `lg:`+ da ular yuqoridagi
              gorizontal modul panelida allaqachon bor, ya'ni bu yerda
              takrorlash edi. Tor ekranda esa o'sha panel yashiringan
              (`hidden lg:flex`), shuning uchun hamburger yagona navigatsiya
              yo'li bo'lib qoladi — u yerda modullarni olib tashlash
              foydalanuvchini butunlay yo'lsiz qoldirardi. */}
          <div className="lg:hidden">
          {visibleSections.map((section) => (
            <div key={section.key} className="pb-2">
              {section.label && (
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) =>
                  item.children ? (
                    // Panelda flyout kerak emas (ro'yxat allaqachon to'liq
                    // ochiq) — "Profillar" shunchaki kichik sarlavha.
                    <div key={item.label}>
                      <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium text-slate-400">{item.label}</p>
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to!}
                          onClick={closeDrawer}
                          className={({ isActive }) => drawerLinkClass(isActive)}
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to!}
                      onClick={closeDrawer}
                      className={({ isActive }) => drawerLinkClass(isActive)}
                    >
                      {item.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          ))}
          </div>

          {hasAdminMenu && (
            <div className="mt-1 border-t border-slate-200 pt-2">
              {visibleAdminItems.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Administratsiya
                  </p>
                  <div className="space-y-0.5">
                    {visibleAdminItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={closeDrawer}
                        className={({ isActive }) => drawerLinkClass(isActive)}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
              {showRolesItem && (
                <NavLink
                  to={ROLES_ITEM.to}
                  onClick={closeDrawer}
                  className={({ isActive }) => drawerLinkClass(isActive)}
                >
                  {ROLES_ITEM.label}
                </NavLink>
              )}
            </div>
          )}

          <div className="mt-1 border-t border-slate-200 pt-2">
            {/* Yordam ham faqat tor ekranda: `lg:`+ da "?" belgisi modul
                qatorining o'ng chetida turibdi, bu yerdagisi takror bo'lardi. */}
            <Link to="/help" onClick={closeDrawer} className={`${drawerLinkClass(false)} lg:hidden`}>
              Yordam
            </Link>
            {/* Platforma boshqaruvi (/admin) — avval navy header'ning o'ng
                tomonida qalqon-belgili havola edi. Hamburger chapga
                ko'chirilganda (2026-09-04) u ham shu panelga ko'chdi:
                AdminPage ilova ichida boshqa hech qanday havola bilan
                bog'lanmagan, ya'ni bu yagona kirish yo'li. */}
            {user?.isPlatformAdmin && (
              <NavLink
                to="/admin"
                onClick={closeDrawer}
                className={({ isActive }) => drawerLinkClass(isActive)}
              >
                <span className="flex items-center gap-2">
                  <AdminShieldIcon />
                  Platforma boshqaruvi
                </span>
              </NavLink>
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 px-4 py-3">
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button onClick={logout} className="mt-1 text-xs text-brand-navy underline hover:opacity-80">
            Chiqish
          </button>
        </div>
      </div>
    </div>
  );
}
