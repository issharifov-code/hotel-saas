import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type LoginResult, type TenantOption } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import folioOneLogoFull from '../assets/folio-one-logo-full.png';
import { LoginIllustration } from '../components/LoginIllustration';
import { LoginIllustrationBooking } from '../components/LoginIllustrationBooking';
import { LoginIllustrationStaff } from '../components/LoginIllustrationStaff';
import { LoginCarousel, type LoginCarouselSlide } from '../components/LoginCarousel';

// Login sahifasi qayta dizayni (2026-09): split-screen (chap — yengil/och fon
// ustida illyustratsiya va xususiyatlar ro'yxati, o'ng — forma), Subdomain
// maydoni olib tashlandi (tenant email orqali avtomatik aniqlanadi —
// AuthContext.login), "Parolni unutdingizmi?" (interim: administratorga
// murojaat), "Demo so'rash" sahifa ichidagi forma, footer.
//
// 2026-09-01: sodda/yengil (soft-illustration) uslubga yangilandi — och ko'k
// fon, yumaloq (pill) input/tugmalar, ikonkali maydonlar. Global `.input` /
// `.btn-primary` klasslariga tegilmadi (ular butun ilova bo'ylab ishlatiladi);
// bu yerdagi pill uslubi to'liq mustaqil Tailwind util klasslari bilan
// yozilgan, shu sahifaga xos.
//
// 2026-09-02: chap paneldagi statik illyustratsiya+xususiyatlar ro'yxati
// avtomatik aylanadigan 3-slaydli carousel'ga (`LoginCarousel`) almashtirildi
// — har bir slayd o'z illyustratsiyasi bilan (bron taqvimi / front desk /
// xodimlar-ruxsatlar). Batafsil xatti-harakat `LoginCarousel.tsx`da.
//
// 2026-09-02 (polish): foydalanuvchi fikr-mulohazasi asosida yana bir tur
// tuzatish — (1) chap panel carousel endi logotipdan keyingi bo'sh joyda
// vertikal markazlashtirilgan (avvalgi `justify-between` ortiqcha bo'sh joy
// qoldirardi), (2) "Parolni unutdingizmi?" havolasi parol maydoni OSTIGA
// ko'chirildi (label bilan bir qatorda zichlik muammosi bor edi), (3) email
// maydoniga misol placeholder qo'shildi, (4) "Ro'yxatdan o'ting" (matn havola)
// va "Demo so'rash" (endi yengil outline tugma) vizual jihatdan aniq
// ajratildi, (5) ikki marta takrorlangan copyright — chap paneldagisi olib
// tashlandi, faqat umumiy footer'dagisi qoldi, (6) accessibility: parol
// ko'rsatish/yashirish tugmasi, "Meni tizimda saqlab qol" checkbox'i (haqiqiy
// ta'sir bilan — localStorage vs sessionStorage, qarang `lib/api.ts`), xato
// xabari uchun `role="alert"`/`aria-live` va maydonlarda `aria-invalid`, (7)
// F1 logotipi atrofidagi ortiqcha oq to'rtburchak (`bg-white p-1 shadow-sm`)
// olib tashlandi — logotip fayli o'zi shaffof, alohida oq fon shart emas edi.
//
// 2026-09-02 (2-tur polish, qo'lda chizilgan skrinshot izohlari asosida):
// (1) logotip foydalanuvchi bergan to'liq lockup (`folio-one-logo-full.png`,
// F1 belgisi + "Folio One" so'zi bitta rasmda) bilan almashtirildi — endi
// alohida `<span>Folio One</span>` matni kerak emas (faqat LoginPage'da;
// AppLayout/AdminPage'dagi kichik ikonka-versiyasi o'zgarmadi), (2) "Meni
// tizimda saqlab qol" → "Meni tizimda eslab qol", (3) "Ro'yxatdan o'ting" →
// "Ro'yxatdan o'tish", (4) shu havola bilan "Demo so'rash" tugmasi orasiga
// kichik "yoki" matni qo'shildi, (5)-(6) 2- va 3-slayd tavsiflari:
// "Tez check-in/out..." → "Tezkor check-in/out...", "...real-time
// hisobotlar" → "...real vaqt hisobotlari" (inglizcha so'z o'rniga o'zbekcha).
//
// 2026-09-02 (3-tur polish): (1) logotip kattalashtirildi (h-10→h-11, ~10%)
// va chap panelda gorizontal markazlashtirildi (`self-start`→`self-center`),
// (2) "Meni tizimda eslab qol" checkbox qatoriga qo'shimcha bo'sh joy
// (`pt-2.5`, ~10px) — parol maydoni ostidagi "Parolni unutdingizmi?"dan
// nafas olishi uchun, (3) "yoki" endi ikki ingichka gorizontal chiziq
// orasida (divider uslubi) ko'rsatiladi. Carousel'ning o'zidagi tuzatishlar
// (`LoginCarousel.tsx`): faol nuqta-indikator sezilarli kattaroq (w-9,
// avvalgi w-6), crossfade yumshoqroq va sekinroq (480ms, avvalgi 350ms) +
// yengil pastdan-yuqoriga siljish qo'shildi (`index.css`dagi
// `folio-carousel-fade`).
//
// 2026-09-02 (4-tur, qo'lda chizilgan skrinshot izohi asosida): logotip
// endi chap (ko'k) panel ichida emas — ikki panelni (ko'k va oq fon)
// "bog'lovchi" element sifatida ularning chegarasi (seam) ustida, gorizontal
// markazda, mutlaq pozitsiyalangan holda ko'rsatiladi (faqat md+ ekranlarda —
// mobil'da panellar ustma-ust joylashgani uchun chegara yo'q, mobil header
// logotipi o'zgarishsiz qoldi). Shu bilan birga biroz kattalashtirildi
// (h-11→h-14, ~27%).

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
    desc: 'Aniq ruxsatlar, housekeeping tasklari va real vaqt hisobotlari',
  },
];

// `hasError` bo'lsa maydon chegarasi/fokus rangi qizg'ishga o'tadi (umumiy
// login xatosi — backend qaysi aniq maydon xato ekanini ajratmaydi, shuning
// uchun ikkala maydon ham belgilanadi). `trailingIcon` parol ko'rsatish/
// yashirish tugmasi uchun o'ng tarafda qo'shimcha joy (pr-11) ochadi.
function pillInputClass({ hasError = false, trailingIcon = false } = {}) {
  return [
    'w-full rounded-full border bg-slate-50 py-2.5 pl-11 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-1',
    trailingIcon ? 'pr-11' : 'pr-4',
    hasError
      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-400'
      : 'border-slate-200 focus:border-brand-navy focus:ring-brand-navy',
  ].join(' ');
}

const pillInputNoIcon =
  'w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-navy focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy';

const pillPrimaryBtn =
  'w-full rounded-full bg-brand-navy py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:opacity-40';

const pillSecondaryBtn =
  'rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-40';

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

type LoginStep = 'credentials' | 'select-tenant';

export function LoginPage() {
  useEffect(() => {
    document.title = 'Folio One | Kirish';
  }, []);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [showForgot, setShowForgot] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleResult = (result: LoginResult) => {
    if (result.status === 'select-tenant') {
      setTenantOptions(result.tenants);
      setStep('select-tenant');
      return;
    }
    navigate(result.user.isPlatformAdmin ? '/admin' : '/dashboard');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      handleResult(await login({ email, password, remember: rememberMe }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const onSelectTenant = async (subdomain: string) => {
    setError(null);
    setLoading(true);
    try {
      handleResult(await login({ subdomain, email, password, remember: rememberMe }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative flex-1 flex flex-col md:flex-row">
        {/* Ko'k va oq panellarni bog'lovchi logotip — ularning chegarasi
            (seam) ustida, gorizontal markazda mutlaq pozitsiyalangan
            (faqat md+; mobil'da panellar ustma-ust bo'lgani uchun chegara
            yo'q, o'sha holat uchun pastdagi mobil header logotipi bor). */}
        <div className="pointer-events-none absolute left-1/2 top-10 z-10 hidden -translate-x-1/2 md:block">
          <img src={folioOneLogoFull} alt="Folio One" className="h-14 w-auto drop-shadow-sm" />
        </div>

        <div className="hidden md:flex md:w-1/2 flex-col bg-gradient-to-br from-[#eef2fd] to-[#dde5fa] p-12 text-slate-900">
          <div className="flex flex-1 items-center justify-center">
            <LoginCarousel slides={SLIDES} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 md:hidden">
              <img src={folioOneLogoFull} alt="Folio One" className="h-10 w-auto" />
            </div>

            {step === 'credentials' && (
              <>
                <h1 className="mb-1 text-2xl font-semibold text-slate-900">Xush kelibsiz!</h1>
                <p className="mb-6 text-sm text-slate-500">Tizimga kirish uchun email va parolingizni kiriting</p>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <div className="relative">
                      <FieldIcon>
                        <MailIcon />
                      </FieldIcon>
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoFocus
                        placeholder="email@hotel.uz"
                        aria-invalid={!!error}
                        className={pillInputClass({ hasError: !!error })}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
                      Parol
                    </label>
                    <div className="relative">
                      <FieldIcon>
                        <LockIcon />
                      </FieldIcon>
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Parolingiz"
                        aria-invalid={!!error}
                        className={pillInputClass({ hasError: !!error, trailingIcon: true })}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgot((v) => !v)}
                        className="text-xs font-medium text-brand-navy hover:underline"
                      >
                        Parolni unutdingizmi?
                      </button>
                    </div>
                  </div>

                  {showForgot && (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      Hozircha parolni faqat mehmonxonangiz administratori "Xodimlar" bo'limidan
                      tiklashi mumkin — administratoringizga murojaat qiling.
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2.5">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-navy focus:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
                    />
                    <label htmlFor="remember-me" className="cursor-pointer select-none text-sm text-slate-600">
                      Meni tizimda eslab qol
                    </label>
                  </div>

                  {error && (
                    <p role="alert" aria-live="polite" className="text-sm text-rose-600">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading} className={pillPrimaryBtn}>
                    {loading ? 'Kirilmoqda...' : 'Kirish'}
                  </button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-500">
                  Yangi mehmonxonami?{' '}
                  <Link to="/register" className="font-medium text-brand-navy hover:underline">
                    Ro'yxatdan o'tish
                  </Link>
                </p>

                <div className="mt-3 flex items-center gap-3" role="presentation">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400">yoki</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDemoForm((v) => !v)}
                    className="inline-flex items-center justify-center rounded-full border border-brand-navy/25 px-4 py-1.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
                  >
                    Demo so'rash
                  </button>
                </div>

                {showDemoForm && <DemoRequestForm onClose={() => setShowDemoForm(false)} />}
              </>
            )}

            {step === 'select-tenant' && (
              <TenantSelectStep
                tenants={tenantOptions}
                loading={loading}
                error={error}
                onSelect={onSelectTenant}
                onBack={() => {
                  setStep('credentials');
                  setError(null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Folio One — barcha huquqlar himoyalangan
      </footer>
    </div>
  );
}

function TenantSelectStep({
  tenants,
  loading,
  error,
  onSelect,
  onBack,
}: {
  tenants: TenantOption[];
  loading: boolean;
  error: string | null;
  onSelect: (subdomain: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Mehmonxonani tanlang</h1>
      <p className="mb-6 text-sm text-slate-500">
        Bu email bir nechta mehmonxonada ro'yxatdan o'tgan — qaysi biriga kirmoqchisiz?
      </p>
      <div className="space-y-2">
        {tenants.map((t) => (
          <button
            key={t.subdomain}
            type="button"
            disabled={loading}
            onClick={() => onSelect(t.subdomain)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition-colors hover:border-brand-navy hover:bg-brand-navy-light disabled:opacity-50"
          >
            <p className="font-medium text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">{t.subdomain}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button type="button" onClick={onBack} className="mt-4 text-sm text-slate-500 hover:underline">
        Orqaga
      </button>
    </div>
  );
}

function DemoRequestForm({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDemoError(null);
    setSubmitting(true);
    try {
      await apiFetch('/marketing/demo-requests', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ fullName, phone, email: demoEmail || undefined }),
      });
      setSent(true);
    } catch (err) {
      setDemoError(err instanceof ApiError ? err.message : 'Yuborishda xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Rahmat! Tez orada siz bilan bog'lanamiz.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Ismingiz</label>
        <input
          required
          className={pillInputNoIcon}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Telefon</label>
        <input
          required
          className={pillInputNoIcon}
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          Email <span className="text-slate-400">(ixtiyoriy)</span>
        </label>
        <input
          type="email"
          className={pillInputNoIcon}
          value={demoEmail}
          onChange={(e) => setDemoEmail(e.target.value)}
        />
      </div>
      {demoError && <p className="text-xs text-rose-600">{demoError}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={`${pillPrimaryBtn} flex-1`}>
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
        <button type="button" onClick={onClose} className={pillSecondaryBtn}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
