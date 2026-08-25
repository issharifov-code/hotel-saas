import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import folioOneLogo from '../assets/folio-one-logo.png';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await login({ subdomain: subdomain || undefined, email, password });
      navigate(loggedInUser.isPlatformAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kirishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-1">
          <img src={folioOneLogo} alt="Folio One" className="h-8 w-8" />
          <h1 className="text-xl font-semibold text-slate-900">Folio One</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Tizimga kirish</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subdomain <span className="text-slate-400">(mehmonxona xodimlari uchun)</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="bukhara-boutique"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parol</label>
            <input
              type="password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-navy text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-navy-dark disabled:opacity-50"
          >
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-4 text-center">
          Yangi mehmonxonami?{' '}
          <a
            href="https://folioone.uz/uz/contact.html"
            target="_blank"
            rel="noopener"
            className="text-brand-navy font-medium underline"
          >
            Demo uchun biz bilan bog'laning
          </a>
        </p>
      </div>
    </div>
  );
}
