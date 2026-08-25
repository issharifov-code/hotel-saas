import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { AdminSubscriptionInvoiceDto, PlanPricingDto, TenantDto, TenantStatus } from '../lib/types';
import folioOneLogo from '../assets/folio-one-logo.png';

const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  trial: 'Sinov muddati',
  active: 'Faol',
  suspended: 'Muzlatilgan',
  cancelled: 'Bekor qilingan',
};

const TENANT_STATUS_COLORS: Record<TenantStatus, string> = {
  trial: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

const PLAN_LABELS: Record<string, string> = { start: 'Start', professional: 'Professional', enterprise: 'Enterprise' };

function money(n: number | string, currency: string): string {
  return `${Number(n).toLocaleString('uz-UZ')} ${currency}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthIso(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

type Tab = 'tenants' | 'billing';

export function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('tenants');
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [invoices, setInvoices] = useState<AdminSubscriptionInvoiceDto[]>([]);
  const [plans, setPlans] = useState<PlanPricingDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filterTenantId, setFilterTenantId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [genTenantId, setGenTenantId] = useState('');
  const [genPeriodStart, setGenPeriodStart] = useState(todayIso());
  const [genPeriodEnd, setGenPeriodEnd] = useState(addMonthIso(todayIso()));
  const [genBusy, setGenBusy] = useState(false);

  const loadTenants = () => apiFetch<TenantDto[]>('/admin/tenants').then(setTenants).catch(() => setError('Tenantlarni yuklashda xatolik'));

  const loadInvoices = () => {
    const qs = new URLSearchParams();
    if (filterTenantId) qs.set('tenantId', filterTenantId);
    if (filterStatus) qs.set('status', filterStatus);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<AdminSubscriptionInvoiceDto[]>(`/admin/billing/invoices${suffix}`)
      .then(setInvoices)
      .catch(() => setError("Hisob-fakturalarni yuklashda xatolik"));
  };

  useEffect(() => {
    setError(null);
    loadTenants();
    apiFetch<PlanPricingDto[]>('/admin/billing/plans').then(setPlans).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'billing') loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterTenantId, filterStatus]);

  const changeTenantStatus = async (tenantId: string, status: TenantStatus) => {
    setError(null);
    try {
      await apiFetch(`/admin/tenants/${tenantId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Holatni o'zgartirishda xatolik");
    }
  };

  const generateInvoice = async () => {
    if (!genTenantId) {
      setError('Hisob-faktura yaratish uchun tenant tanlang');
      return;
    }
    setGenBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/billing/tenants/${genTenantId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({ periodStart: genPeriodStart, periodEnd: genPeriodEnd }),
      });
      await loadInvoices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hisob-faktura yaratishda xatolik");
    } finally {
      setGenBusy(false);
    }
  };

  const markPaid = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/admin/billing/invoices/${id}/mark-paid`, { method: 'POST' });
      await loadInvoices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "To'langan deb belgilashda xatolik");
    }
  };

  const cancelInvoice = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/admin/billing/invoices/${id}/cancel`, { method: 'POST' });
      await loadInvoices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bekor qilishda xatolik");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img src={folioOneLogo} alt="Folio One" className="h-6 w-6" />
            <p className="font-semibold text-slate-900">Folio One — Platforma boshqaruvi</p>
          </div>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-600 hover:text-slate-900 underline">
          Chiqish
        </button>
      </header>

      <div className="px-8 py-6">
        <div className="flex gap-2 mb-6">
          {(['tenants', 'billing'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                tab === t ? 'bg-brand-navy text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {t === 'tenants' ? 'Tenantlar' : 'Billing'}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {tab === 'tenants' && (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {tenants.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.subdomain} · {PLAN_LABELS[t.plan]} · {t.baseCurrency}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TENANT_STATUS_COLORS[t.status]}`}>
                    {TENANT_STATUS_LABELS[t.status]}
                  </span>
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    value={t.status}
                    onChange={(e) => changeTenantStatus(t.id, e.target.value as TenantStatus)}
                  >
                    {(Object.keys(TENANT_STATUS_LABELS) as TenantStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {TENANT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {tenants.length === 0 && <p className="p-4 text-sm text-slate-400">Tenantlar mavjud emas</p>}
          </div>
        )}

        {tab === 'billing' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-900 mb-3">Yangi hisob-faktura yaratish</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={genTenantId}
                  onChange={(e) => setGenTenantId(e.target.value)}
                >
                  <option value="">Tenant tanlang</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({PLAN_LABELS[t.plan]})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={genPeriodStart}
                  onChange={(e) => setGenPeriodStart(e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={genPeriodEnd}
                  onChange={(e) => setGenPeriodEnd(e.target.value)}
                />
                <button
                  onClick={generateInvoice}
                  disabled={genBusy}
                  className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-dark disabled:opacity-50"
                >
                  {genBusy ? 'Yaratilmoqda...' : 'Yaratish'}
                </button>
              </div>
              {plans.length > 0 && genTenantId && (
                <p className="text-xs text-slate-400 mt-2">
                  Summasi tanlangan tenantning joriy rejasidan avtomatik hisoblanadi.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={filterTenantId}
                onChange={(e) => setFilterTenantId(e.target.value)}
              >
                <option value="">Barcha tenantlar</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Barcha holatlar</option>
                <option value="pending">To'lanmagan</option>
                <option value="paid">To'langan</option>
                <option value="cancelled">Bekor qilingan</option>
              </select>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{inv.tenantName ?? inv.tenantId}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {inv.periodStart} — {inv.periodEnd} · Muddat: {inv.dueDate}
                      {inv.isOverdue && inv.status === 'pending' && (
                        <span className="text-red-600 font-medium"> · muddati o'tgan</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-900">{money(inv.amount, inv.currency)}</p>
                    {inv.status === 'pending' && (
                      <>
                        <button
                          onClick={() => markPaid(inv.id)}
                          className="rounded-md bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700"
                        >
                          To'landi deb belgilash
                        </button>
                        <button
                          onClick={() => cancelInvoice(inv.id)}
                          className="rounded-md border border-slate-300 text-xs font-medium px-3 py-1.5 hover:bg-slate-100"
                        >
                          Bekor qilish
                        </button>
                      </>
                    )}
                    {inv.status !== 'pending' && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {inv.status === 'paid' ? "To'langan" : 'Bekor qilingan'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {invoices.length === 0 && <p className="p-4 text-sm text-slate-400">Hisob-fakturalar mavjud emas</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
