import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setToken, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/register-tenant', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(form),
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Yangi mehmonxona</h1>
        <p className="text-sm text-slate-500 mb-6">
          Ro'yxatdan o'tgach, standart rollar (Egasi, Buxgalter, Front Desk va h.k.) avtomatik yaratiladi.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Mehmonxona nomi" value={form.tenantName} onChange={update('tenantName')} />
          <Field
            label="Subdomain"
            value={form.subdomain}
            onChange={update('subdomain')}
            placeholder="masalan: bukhara-boutique"
          />
          <Field label="Sizning to'liq ismingiz" value={form.ownerFullName} onChange={update('ownerFullName')} />
          <Field label="Email" type="email" value={form.ownerEmail} onChange={update('ownerEmail')} />
          <Field
            label="Parol"
            type="password"
            value={form.ownerPassword}
            onChange={update('ownerPassword')}
          />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-navy text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-navy-dark disabled:opacity-50"
          >
            {loading ? 'Yaratilmoqda...' : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-4 text-center">
          Hisobingiz bormi?{' '}
          <Link to="/login" className="text-slate-900 font-medium underline">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
