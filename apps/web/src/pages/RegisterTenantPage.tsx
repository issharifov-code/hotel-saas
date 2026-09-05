import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setToken, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import folioOneLogo from '../assets/folio-one-logo.png';
import folioOneLogoFull from '../assets/folio-one-logo-full.png';
import { LoginIllustration } from '../components/LoginIllustration';
import { LoginIllustrationBooking } from '../components/LoginIllustrationBooking';
import { LoginIllustrationStaff } from '../components/LoginIllustrationStaff';
import { LoginCarousel, type LoginCarouselSlide } from '../components/LoginCarousel';

// 2026-09-03: sahifa Login sahifasi bilan bir xil split-screen dizaynga
// o'tkazildi (avval mustaqil, markazlashgan bitta karta edi). Chap panelda
// xuddi login sahifasidagi kabi aylanadigan illyustratsiya-carousel, o'ng
// panelda forma — logotip, markazlashgan sarlavha/tavsif, chapga
// tekislangan label/input'lar, "Kirish" sahifasiga qaytish havolasi, umumiy
// footer. Desktop scroll xatti-harakati ham login sahifasiga mos: global
// sahifa scroll yo'q (`md:h-[100dvh] md:overflow-hidden`), faqat o'ng panel
// ichki kontenti kerak bo'lsa scroll bo'ladi, chap panel/footer joyida
// qoladi. Mobil'da forma tepasida ixcham carousel-hero ko'rinadi. Pill
// uslubidagi input/tugma klasslari va ikonkalar login sahifasidan ataylab
// nusxalandi (mustaqil, faqat shu faylga xos — LoginPage.tsx'ga tegilmadi,
// login sahifasining o'zi o'zgarishsiz qoldi).
//
// 2026-09-03 (2-tur): foydalanuvchi to'rtta qo'shimcha tuzatish so'radi:
// (1) "Subdomain" maydoni UI'dan BUTUNLAY olib tashlandi — u tushunarsiz
// texnik atama edi. Subdomain hamon backend'da SHART (tenant marshrutlash
// uchun), shuning uchun mehmonxona nomidan avtomatik hosil qilinadi
// (`slugify`, foydalanuvchiga umuman ko'rsatilmaydi) va yuborishda band
// bo'lib chiqsa (409, "Bu subdomain allaqachon band"), foydalanuvchiga
// bildirmasdan tasodifiy qo'shimcha bilan avtomatik qayta urinadi
// (`registerWithSubdomainRetry`). (2) "Parolni tasdiqlang" maydoni
// qo'shildi, mos kelmasa forma yuborilmaydi. (3) Yangi ixtiyoriy
// "Xonalar soni" (backend: `Tenant.roomsCountHint`, demo formadagi bir xil
// bucket qiymatlari) va "Lavozimingiz" (backend: `User.position`, erkin
// matn, Ism va familiyangizdan keyin) maydonlari qo'shildi. (4) Muvaffaqiyatli
// ro'yxatdan o'tgandan so'ng darhol `/dashboard`ga o'tish o'rniga, forma
// o'rnida tabrik ekrani ko'rsatiladi ("Tabriklaymiz..."), "Davom etish"
// tugmasi bosilgandagina dashboard'ga o'tadi — bu har doim FAQAT birinchi
// marta ro'yxatdan o'tishda ko'rinadi, chunki `/register` har doim yangi
// tenant yaratadi.
//
// 2026-09-03 (3-tur): Mobil'da forma tepasidagi ixcham carousel-hero
// (`LoginCarousel compact`, `md:hidden` bloki) olib tashlandi — foydalanuvchi
// mobil versiyalarda aylanadigan elementlarni istamadi (hech bir sahifada,
// LoginPage.tsx'da ham xuddi shunday olib tashlandi). Desktop'dagi chap
// panel carousel'i o'zgarishsiz qoldi.

const SLIDES: LoginCarouselSlide[] = [
  {
    illustration: <LoginIllustrationBooking className="h-64 w-64" />,
    title: 'Bronlar va xonalar',
    desc: 'Bron taqvimi, Channel Manager va real vaqtdagi bandlik',
  },
  {
    illustration: <LoginIllustration className="h-64 w-64" />,
    title: 'Front Desk va moliya',
    desc: "Tezkor check-in/out, folio, to'lovlar va kunni yopish",
  },
  {
    illustration: <LoginIllustrationStaff className="h-64 w-64" />,
    title: 'Xodimlar va nazorat',
    desc: 'Aniq ruxsatlar, housekeeping vazifalari va real vaqt hisobotlari',
  },
];

const ROOM_COUNT_OPTIONS = ['1–20', '21–50', '51–100', '100+'];

function pillInputClass({ hasError = false, trailingIcon = false } = {}) {
  return [
    'w-full rounded-full border bg-slate-50 py-4 pl-11 text-sm text-slate-900 placeholder-slate-500 transition-colors focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
    trailingIcon ? 'pr-11' : 'pr-4',
    hasError
      ? 'border-rose-300 hover:border-rose-400 focus:border-rose-500 focus:ring-rose-300'
      : 'border-slate-200 hover:border-slate-300 focus:border-brand-navy/70 focus:ring-brand-navy/20',
  ].join(' ');
}

const pillInputNoIcon =
  'w-full rounded-full border border-slate-200 bg-slate-50 py-4 px-4 text-sm text-slate-900 placeholder-slate-500 transition-colors hover:border-slate-300 focus:border-brand-navy/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60';

const pillPrimaryBtn =
  'w-full rounded-full bg-brand-navy py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:opacity-40';

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
      {children}
    </span>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M3 3l18 18M10.6 5.2A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.3 0 2.5-.2 3.6-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Foydalanuvchiga hech qachon ko'rsatilmaydi — faqat backend'ga yuborish
// uchun ichki identifikator. Uzbek apostrofsimon belgilarni (`o'`/`g'`dagi
// `'`/`'`/`ʻ`/`ʼ`/`` ` ``) olib tashlaydi (harflarga qo'shilib ketadi, tire
// qo'shilmaydi — "Farg'ona" → "fargona"), qolgan ruxsat etilmagan
// belgilarni tire bilan almashtiradi, ketma-ket tirelarni birlashtiradi,
// chetdagi tirelarni kesadi, 63 belgiga cheklaydi (backend regex bilan mos).
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’ʻʼ`]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

const MAX_SUBDOMAIN_ATTEMPTS = 5;

// Subdomain foydalanuvchiga ko'rinmagani uchun, agar avtomatik hosil
// qilingan qiymat allaqachon band bo'lsa (409, "...subdomain..."),
// foydalanuvchini bezovta qilmasdan tasodifiy qo'shimcha bilan bir necha
// marta avtomatik qayta uriniladi. Boshqa har qanday xato (masalan email
// band) darhol tashqariga uzatiladi.
async function registerWithSubdomainRetry(
  buildBody: (subdomain: string) => Record<string, unknown>,
  baseSlug: string,
): Promise<{ accessToken: string }> {
  const base = baseSlug || 'mehmonxona';
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SUBDOMAIN_ATTEMPTS; attempt++) {
    const subdomain = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    try {
      return await apiFetch<{ accessToken: string }>('/auth/register-tenant', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(buildBody(subdomain)),
      });
    } catch (err) {
      const isSubdomainCollision =
        err instanceof ApiError && err.status === 409 && /subdomain/i.test(err.message);
      if (!isSubdomainCollision) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

export function RegisterTenantPage() {
  useEffect(() => {
    document.title = "Folio One | Ro'yxatdan o'tish";
  }, []);

  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    tenantName: '',
    roomsCountHint: '',
    ownerFullName: '',
    ownerPosition: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const update =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== form.ownerPassword;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.ownerPassword !== confirmPassword) {
      setError('Parollar bir-biriga mos kelmadi');
      return;
    }

    setLoading(true);
    try {
      const baseSlug = slugify(form.tenantName);
      const res = await registerWithSubdomainRetry(
        (subdomain) => ({
          tenantName: form.tenantName,
          subdomain,
          ownerFullName: form.ownerFullName,
          ownerPosition: form.ownerPosition || undefined,
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
          roomsCountHint: form.roomsCountHint || undefined,
        }),
        baseSlug,
      );
      setToken(res.accessToken);
      await refresh();
      setRegistered(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ro'yxatdan o'tishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden">
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="hidden md:flex md:w-1/2 md:overflow-hidden flex-col bg-gradient-to-br from-[#f7f2e8] to-[#eee4d2] p-12 text-slate-900">
          <div className="flex flex-1 items-center justify-center">
            <LoginCarousel slides={SLIDES} />
          </div>
        </div>

        <div className="flex flex-1 flex-col bg-white px-6 py-12 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto w-full max-w-sm md:my-auto">
            <div className="-mt-4 mb-7 flex justify-center">
              <img src={folioOneLogoFull} alt="Folio One" aria-hidden="true" className="h-16 w-auto" />
            </div>

            {registered ? (
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircleIcon />
                </div>
                <h1 className="mb-2 text-2xl font-semibold text-slate-900">
                  Tabriklaymiz, siz ro'yxatdan muvaffaqiyatli o'tdingiz!
                </h1>
                <p className="mb-8 text-sm text-slate-600">
                  Mehmonxonangiz tizimda yaratildi. Endi Folio One'da ishlashni boshlashingiz mumkin.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className={pillPrimaryBtn}
                >
                  Davom etish
                </button>
              </div>
            ) : (
              <>
                <h1 className="mb-2 text-center text-2xl font-semibold text-slate-900">Yangi mehmonxona</h1>
                <p className="mb-8 text-center text-sm text-slate-600">
                  Ro'yxatdan o'tgach, standart rollar (Egasi, Buxgalter, Front Desk va h.k.) avtomatik
                  yaratiladi.
                </p>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reg-tenant-name" className="mb-1 block text-sm font-semibold text-slate-700">
                      Mehmonxona nomi
                    </label>
                    <input
                      id="reg-tenant-name"
                      required
                      className={pillInputNoIcon}
                      value={form.tenantName}
                      onChange={update('tenantName')}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-rooms-count" className="mb-1 block text-sm font-semibold text-slate-700">
                      Xonalar soni <span className="font-normal text-slate-400">(ixtiyoriy)</span>
                    </label>
                    <div className="relative">
                      <select
                        id="reg-rooms-count"
                        className={`${pillInputNoIcon} appearance-none pr-9`}
                        value={form.roomsCountHint}
                        onChange={update('roomsCountHint')}
                      >
                        <option value="">Tanlang</option>
                        {ROOM_COUNT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <ChevronDownIcon />
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-owner-name" className="mb-1 block text-sm font-semibold text-slate-700">
                      Ism va familiyangiz
                    </label>
                    <input
                      id="reg-owner-name"
                      required
                      className={pillInputNoIcon}
                      value={form.ownerFullName}
                      onChange={update('ownerFullName')}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-owner-position" className="mb-1 block text-sm font-semibold text-slate-700">
                      Lavozimingiz <span className="font-normal text-slate-400">(ixtiyoriy)</span>
                    </label>
                    <input
                      id="reg-owner-position"
                      placeholder="masalan: Egasi, Bosh menejer"
                      className={pillInputNoIcon}
                      maxLength={150}
                      value={form.ownerPosition}
                      onChange={update('ownerPosition')}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="mb-1 block text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <div className="relative">
                      <FieldIcon>
                        <MailIcon />
                      </FieldIcon>
                      <input
                        id="reg-email"
                        type="email"
                        required
                        placeholder="email@hotel.uz"
                        aria-invalid={!!error}
                        className={pillInputClass({ hasError: !!error })}
                        value={form.ownerEmail}
                        onChange={update('ownerEmail')}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="mb-1 block text-sm font-semibold text-slate-700">
                      Parol
                    </label>
                    <div className="relative">
                      <FieldIcon>
                        <LockIcon />
                      </FieldIcon>
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={10}
                        placeholder="Kamida 10 belgi"
                        aria-invalid={!!error}
                        className={pillInputClass({ hasError: !!error, trailingIcon: true })}
                        value={form.ownerPassword}
                        onChange={update('ownerPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password-confirm" className="mb-1 block text-sm font-semibold text-slate-700">
                      Parolni tasdiqlang
                    </label>
                    <div className="relative">
                      <FieldIcon>
                        <LockIcon />
                      </FieldIcon>
                      <input
                        id="reg-password-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Parolni qayta kiriting"
                        aria-invalid={passwordMismatch}
                        className={pillInputClass({ hasError: passwordMismatch, trailingIcon: true })}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
                      >
                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {passwordMismatch && (
                      <p className="mt-1.5 text-sm text-rose-600">Parollar bir-biriga mos kelmadi</p>
                    )}
                  </div>

                  {error && (
                    <p role="alert" aria-live="polite" className="text-sm text-rose-600">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading} className={pillPrimaryBtn}>
                    {loading ? 'Yaratilmoqda...' : "Ro'yxatdan o'tish"}
                  </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500">
                  Hisobingiz bormi?{' '}
                  <Link to="/login" className="font-medium text-brand-navy hover:underline">
                    Kirish
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 md:justify-start md:pl-16">
        <a
          href="https://folioone.uz"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Folio One — folioone.uz saytiga o'tish"
          className="flex items-center rounded transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
        >
          <img src={folioOneLogo} alt="" aria-hidden="true" className="h-5 w-5" />
        </a>
        <span>© {new Date().getFullYear()} Folio One — barcha huquqlar himoyalangan</span>
      </footer>
    </div>
  );
}
