import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type LoginResult, type TenantOption } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import folioOneLogo from '../assets/folio-one-logo.png';

// Login sahifasi qayta dizayni (2026-09): split-screen (chap — brend/xususiyatlar
// paneli, o'ng — forma), Subdomain maydoni olib tashlandi (tenant email orqali
// avtomatik aniqlanadi — AuthContext.login), "Parolni unutdingizmi?" (interim:
// administratorga murojaat), "Demo so'rash" endi sahifa ichidagi forma, footer.

const FEATURES = [
  { title: 'Bronlar va xonalar', desc: 'Bron taqvimi, Channel Manager, real vaqtda bandlik' },
  { title: 'Front Desk va hisobotlar', desc: "Check-in/out, kunni yopish, moliyaviy tahlil" },
  { title: 'Xodimlar va ruxsatlar', desc: 'Har bir xodim uchun aniq belgilangan huquqlar' },
];

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
        <div className="hidden md:flex md:w-1/2 bg-brand-navy text-white flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <img src={folioOneLogo} alt="Folio One" className="h-8 w-8 rounded bg-white p-1" />
            <span className="text-xl font-semibold">Folio One</span>
          </div>
          <div className="space-y-8 max-w-sm">
            <h2 className="text-3xl font-semibold leading-tight">
              Mehmonxonangizni bitta joydan boshqaring
            </h2>
            <ul className="space-y-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-sm text-white/70">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">© {new Date().getFullYear()} Folio One</p>
        </div>

        <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center gap-2 md:hidden">
              <img src={folioOneLogo} alt="Folio One" className="h-8 w-8" />
              <h1 className="text-xl font-semibold text-slate-900">Folio One</h1>
            </div>

            {step === 'credentials' && (
              <>
                <h1 className="mb-1 text-xl font-semibold text-slate-900">Tizimga kirish</h1>
                <p className="mb-6 text-sm text-slate-500">Email va parolingizni kiriting</p>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      type="email"
                      required
                      autoFocus
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700">Parol</label>
                      <button
                        type="button"
                        onClick={() => setShowForgot((v) => !v)}
                        className="text-xs font-medium text-brand-navy underline"
                      >
                        Parolni unutdingizmi?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {showForgot && (
                    <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      Hozircha parolni faqat mehmonxonangiz administratori "Xodimlar" bo'limidan
                      tiklashi mumkin — administratoringizga murojaat qiling.
                    </p>
                  )}

                  {error && <p className="text-sm text-rose-600">{error}</p>}

                  <button type="submit" disabled={loading} className="btn-primary w-full py-2">
                    {loading ? 'Kirilmoqda...' : 'Kirish'}
                  </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500">
                  Yangi mehmonxonami?{' '}
                  <Link to="/register" className="font-medium text-brand-navy underline">
                    Ro'yxatdan o'ting
                  </Link>
                </p>

                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDemoForm((v) => !v)}
                    className="text-sm font-medium text-brand-navy underline"
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
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Mehmonxonani tanlang</h1>
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
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-left text-sm hover:border-brand-navy hover:bg-brand-navy-light disabled:opacity-50"
          >
            <p className="font-medium text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">{t.subdomain}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button type="button" onClick={onBack} className="mt-4 text-sm text-slate-500 underline">
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
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Rahmat! Tez orada siz bilan bog'lanamiz.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Ismingiz</label>
        <input required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Telefon</label>
        <input
          required
          className="input"
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
          className="input"
          value={demoEmail}
          onChange={(e) => setDemoEmail(e.target.value)}
        />
      </div>
      {demoError && <p className="text-xs text-rose-600">{demoError}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2 text-sm">
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary py-2 text-sm">
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
