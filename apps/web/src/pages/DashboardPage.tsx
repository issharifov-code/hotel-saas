import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: { module: string; action: string }[];
}

const MODULES = [
  { key: 'booking', label: 'Bron / Xona boshqaruvi', link: '/bookings' },
  { key: 'front_desk', label: 'Front Desk' },
  { key: 'housekeeping', label: 'Housekeeping', link: '/housekeeping' },
  { key: 'warehouse', label: 'Warehouse (Ombor)', link: '/warehouse' },
  { key: 'pos', label: 'POS', link: '/pos' },
  { key: 'guest_crm', label: 'Guest CRM / Loyalty', link: '/guests' },
  { key: 'invoicing', label: 'Invoicing', link: '/invoicing' },
  { key: 'accounting', label: 'Moliyaviy hisob (USALI)' },
  { key: 'reports', label: 'Hisobot / Dashboard' },
  { key: 'billing', label: 'SaaS Billing' },
];

export function DashboardPage() {
  const { user, permissions } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    if (!user?.tenantId) return;
    apiFetch<Role[]>('/roles').then(setRoles).catch(() => {});
  }, [user?.tenantId]);

  const hasAccess = (moduleKey: string) => permissions.some((p) => p.startsWith(`${moduleKey}:`));

  return (
    <AppLayout title="Bosh sahifa">
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Modullar</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {MODULES.map((m) => {
              const active = hasAccess(m.key);
              const Card = (
                <div
                  className={`rounded-lg border p-3 text-sm h-full ${
                    active
                      ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      : 'border-slate-100 bg-slate-100 text-slate-400'
                  }`}
                >
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs mt-1">{active ? 'Ruxsat bor' : "Ruxsat yo'q"}</p>
                </div>
              );
              return active && m.link ? (
                <Link key={m.key} to={m.link}>
                  {Card}
                </Link>
              ) : (
                <div key={m.key}>{Card}</div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Rollar ({roles.length})</h2>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {roles.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.isSystem ? 'Standart rol' : 'Custom rol'} · {r.permissions.length} ta ruxsat
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
