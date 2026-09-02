import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { apiFetch } from '../lib/api';
import type { PlanPricingDto, SubscriptionInvoiceDto, TenantSubscriptionDto } from '../lib/types';

const TENANT_STATUS_LABELS: Record<string, string> = {
  trial: 'Sinov muddati',
  active: 'Faol',
  suspended: 'Muzlatilgan',
  cancelled: 'Bekor qilingan',
};

const TENANT_STATUS_COLORS: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "To'lanmagan",
  paid: "To'langan",
  cancelled: 'Bekor qilingan',
};

function invoiceStatusBadge(invoice: SubscriptionInvoiceDto): { label: string; color: string } {
  if (invoice.status === 'pending' && invoice.isOverdue) {
    return { label: 'Muddati o\'tgan', color: 'bg-red-100 text-red-800' };
  }
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-200 text-slate-600',
  };
  return { label: INVOICE_STATUS_LABELS[invoice.status], color: colors[invoice.status] };
}

function money(n: number | string, currency: string): string {
  return `${Number(n).toLocaleString('uz-UZ')} ${currency}`;
}

export function BillingPage() {
  const [subscription, setSubscription] = useState<TenantSubscriptionDto | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoiceDto[]>([]);
  const [plans, setPlans] = useState<PlanPricingDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      apiFetch<TenantSubscriptionDto>('/billing/subscription'),
      apiFetch<SubscriptionInvoiceDto[]>('/billing/invoices'),
      apiFetch<PlanPricingDto[]>('/billing/plans'),
    ])
      .then(([sub, inv, pl]) => {
        setSubscription(sub);
        setInvoices(inv);
        setPlans(pl);
      })
      .catch(() => setError("Obuna ma'lumotlarini yuklashda xatolik yuz berdi"));
  }, []);

  return (
    <AppLayout title="Obuna va to'lovlar">
      <div className="space-y-6">
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {subscription && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Joriy reja</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{subscription.pricing.label}</p>
              <span
                className={`inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${TENANT_STATUS_COLORS[subscription.status]}`}
              >
                {TENANT_STATUS_LABELS[subscription.status]}
              </span>
              <p className="text-sm text-slate-600 mt-3">
                {money(subscription.pricing.monthlyPrice, subscription.pricing.currency)} / oy
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Limitlar: {subscription.pricing.maxProperties} ta filial, {subscription.pricing.maxUsers} ta foydalanuvchigacha
              </p>
            </div>

            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-900 mb-3">So'nggi hisob-faktura</p>
              {subscription.latestInvoice ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      {subscription.latestInvoice.periodStart} — {subscription.latestInvoice.periodEnd}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      To'lov muddati: {subscription.latestInvoice.dueDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {money(subscription.latestInvoice.amount, subscription.latestInvoice.currency)}
                    </p>
                    <span
                      className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatusBadge(subscription.latestInvoice).color}`}
                    >
                      {invoiceStatusBadge(subscription.latestInvoice).label}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Hozircha hisob-faktura yaratilmagan</p>
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Hisob-fakturalar tarixi</h2>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {invoices.length === 0 && <p className="p-4 text-sm text-slate-500">Hisob-fakturalar mavjud emas</p>}
            {invoices.map((inv) => {
              const badge = invoiceStatusBadge(inv);
              return (
                <div key={inv.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {inv.periodStart} — {inv.periodEnd}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Muddat: {inv.dueDate}
                      {inv.paidAt && ` · To'landi: ${inv.paidAt.slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{money(inv.amount, inv.currency)}</p>
                    <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Tarif rejalari</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.plan}
                className={`rounded-lg border p-5 ${
                  subscription?.plan === p.plan ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                } bg-white`}
              >
                <p className="font-semibold text-slate-900">{p.label}</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{money(p.monthlyPrice, p.currency)}</p>
                <p className="text-xs text-slate-400">oyiga</p>
                <p className="text-sm text-slate-600 mt-3">{p.maxProperties} ta filialgacha</p>
                <p className="text-sm text-slate-600">{p.maxUsers} ta foydalanuvchigacha</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Rejani o'zgartirish uchun platforma administratori bilan bog'laning.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
