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

// "Subdomain" tushunarsiz atama ekani haqida foydalanuvchi fikr bildirdi
// (2026-09-03) — bu maydon nima uchun kerakligi (mehmonxonaning tizimdagi
// noyob manzili, masalan mehmonlar uchun ochiq bron sahifasida ishlatiladi)
// oldin hech qanday izohsiz, alohida qo'lda to'ldiriladigan maydon sifatida
// ko'rsatilardi. Endi mehmonxona nomidan avtomatik hosil qilinadi (Slack/
// Notion'dagi workspace-slug naqshiga o'xshash) va pastida jonli ko'rinadi;
// foydalanuvchi hali ham qo'lda tahrirlashi mumkin — birinchi qo'lda
// tahrirlashdan keyin avtomatik yangilanish to'xtaydi (`subdomainTouched`),
// aks holda foydalanuvchining qo'lda kiritgani nomni o'zgartirganda ustidan
// yozib yuborilardi. Yozayotganda chetdagi tire kesilmaydi (foydalanuvchi
// "bukhara-" deb yozayotganda tire darhol olib tashlanmasligi kerak),
// faqat maydondan chiqqanda (`onBlur`) va nom asosida avtomatik hosil
// qilinganda chetlar tozalanadi.
function slugify(value: string, { trimEdges = true } = {}) {
  let out = value
    .toLowerCase()
    .replace(/['’ʻʼ`]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-');
  if (trimEdges) out = out.replace(/^-+|-+$/g, '');
  return out.slice(0, 63);
}

export function RegisterTenantPage() {
  useEffect(() => {
    document.title = "Folio One | Ro'yxatdan o'tish";
  }, []);

  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    tenantName: '',
    subdomain: '',
    ownerFullName: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onTenantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, tenantName: value, subdomain: subdomainTouched ? f.subdomain : slugify(value) }));
  };

  const onSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubdomainTouched(true);
    setForm((f) => ({ ...f, subdomain: slugify(e.target.value, { trimEdges: false }) }));
  };

  const onSubdomainBlur = () => {
    setForm((f) => ({ ...f, subdomain: slugify(f.subdomain) }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Agar foydalanuvchi "Enter" bilan to'g'ridan-to'g'ri subdomain
    // maydonidan yuborsa, `onBlur` ishga tushmasligi mumkin — shuning
    // uchun chetdagi tire yuborishdan oldin ham qat'iy tozalanadi.
    const trimmedSubdomain = slugify(form.subdomain);
    setForm((f) => ({ ...f, subdomain: trimmedSubdomain }));
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/register-tenant', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ ...form, subdomain: trimmedSubdomain }),
      });
      setToken(res.accessToken);
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ro'yxatdan o'tishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden">
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="hidden md:flex md:w-1/2 md:overflow-hidden flex-col bg-gradient-to-br from-[#eef2fd] to-[#dde5fa] p-12 text-slate-900">
          <div className="flex flex-1 items-center justify-center">
            <LoginCarousel slides={SLIDES} />
          </div>
        </div>

        <div className="flex flex-1 flex-col bg-white px-6 py-12 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto w-full max-w-sm md:my-auto">
            <div className="-mt-4 mb-7 flex justify-center">
              <img src={folioOneLogoFull} alt="Folio One" aria-hidden="true" className="h-16 w-auto" />
            </div>

            <div className="mb-7 md:hidden">
              <LoginCarousel slides={SLIDES} compact />
            </div>

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
                  onChange={onTenantNameChange}
                />
              </div>

              <div>
                <label htmlFor="reg-subdomain" className="mb-1 block text-sm font-semibold text-slate-700">
                  Manzilingiz (subdomain)
                </label>
                <input
                  id="reg-subdomain"
                  required
                  placeholder="masalan: bukhara-boutique"
                  className={pillInputNoIcon}
                  value={form.subdomain}
                  onChange={onSubdomainChange}
                  onBlur={onSubdomainBlur}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  Mehmonxonangiz nomidan avtomatik hosil bo'ladi, xohlasangiz o'zgartirishingiz mumkin —
                  mehmonlar uchun bron sahifasi shu manzilda ochiladi:{' '}
                  <span className="font-medium text-slate-500">
                    {form.subdomain || 'mehmonxona-nomi'}.usali.uz
                  </span>
                </p>
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
                    placeholder="Parol yarating"
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
