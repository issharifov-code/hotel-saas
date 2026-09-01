import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type LoginResult, type TenantOption } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import folioOneLogo from '../assets/folio-one-logo.png';
import { LoginIllustration } from '../components/LoginIllustration';

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

const FEATURES = [
  { title: 'Bronlar va xonalar', desc: 'Bron taqvimi, Channel Manager, real vaqtda bandlik' },
  { title: 'Front Desk va hisobotlar', desc: "Check-in/out, kunni yopish, moliyaviy tahlil" },
  { title: 'Xodimlar va ruxsatlar', desc: 'Har bir xodim uchun aniq belgilangan huquqlar' },
];

const pillInput =
  'w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-navy focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy';

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
      handleResult(await login({ email, password }));
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
      handleResult(await login({ subdomain, email, password }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="hidden md:flex md:w-1/2 flex-col justify-between bg-gradient-to-br from-[#eef2fd] to-[#dde5fa] p-12 text-slate-900">
          <div className="flex items-center gap-2">
            <img src={folioOneLogo} alt="Folio One" className="h-8 w-8 rounded bg-white p-1 shadow-sm" />
            <span className="text-xl font-semibold">Folio One</span>
          </div>

          <div className="flex flex-col items-center gap-8">
            <LoginIllustration className="h-64 w-64" />
            <div className="max-w-sm space-y-6">
              <h2 className="text-center text-2xl font-semibold leading-tight text-brand-navy">
                Mehmonxonangizni bitta joydan boshqaring
              </h2>
              <ul className="space-y-4">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                    <div>
                      <p className="font-medium text-slate-800">{f.title}</p>
                      <p className="text-sm text-slate-500">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Folio One</p>
        </div>

        <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center gap-2 md:hidden">
              <img src={folioOneLogo} alt="Folio One" className="h-8 w-8" />
              <h1 className="text-xl font-semibold text-slate-900">Folio One</h1>
            </div>

            {step === 'credentials' && (
              <>
                <h1 className="mb-1 text-2xl font-semibold text-slate-900">Xush kelibsiz!</h1>
                <p className="mb-6 text-sm text-slate-500">Tizimga kirish uchun email va parolingizni kiriting</p>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <div className="relative">
                      <FieldIcon>
                        <MailIcon />
                      </FieldIcon>
                      <input
                        type="email"
                        required
                        autoFocus
                        className={pillInput}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700">Parol</label>
                      <button
                        type="button"
                        onClick={() => setShowForgot((v) => !v)}
                        className="text-xs font-medium text-brand-navy hover:underline"
                      >
                        Parolni unutdingizmi?
                      </button>
                    </div>
                    <div className="relative">
                      <FieldIcon>
                        <LockIcon />
                      </FieldIcon>
                      <input
                        type="password"
                        required
                        className={pillInput}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {showForgot && (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      Hozircha parolni faqat mehmonxonangiz administratori "Xodimlar" bo'limidan
                      tiklashi mumkin — administratoringizga murojaat qiling.
                    </p>
                  )}

                  {error && <p className="text-sm text-rose-600">{error}</p>}

                  <button type="submit" disabled={loading} className={pillPrimaryBtn}>
                    {loading ? 'Kirilmoqda...' : 'Kirish'}
                  </button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-500">
                  Yangi mehmonxonami?{' '}
                  <Link to="/register" className="font-medium text-brand-navy hover:underline">
                    Ro'yxatdan o'ting
                  </Link>
                </p>

                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDemoForm((v) => !v)}
                    className="text-sm font-medium text-brand-navy hover:underline"
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
