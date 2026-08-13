import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: { module: string; action: string }[];
}

const MODULES = [
  { key: 'booking', label: 'Bron / Xona boshqaruvi' },
  { key: 'front_desk', label: 'Front Desk' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'warehouse', label: 'Warehouse (Ombor)' },
  { key: 'pos', label: 'POS' },
  { key: 'guest_crm', label: 'Guest CRM / Loyalty' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'accounting', label: 'Moliyaviy hisob (USALI)' },
  { key: 'reports', label: 'Hisobot / Dashboard' },
  { key: 'billing', label: 'SaaS Billing' },
];

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.tenantId) return;
    apiFetch<Role[]>('/roles').then(setRoles).catch(() => {});
    apiFetch<string[]>('/me/permissions').then(setPermissions).catch(() => {});
  }, [user?.tenantId]);

  const hasAccess = (moduleKey: string) =>
    permissions.some((p) => p.startsWith(`${moduleKey}:`));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Hotel SaaS</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Chiqish
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Modullar</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {MODULES.map((m) => {
              const active = hasAccess(m.key);
              return (
                <div
                  key={m.key}
                  className={`rounded-lg border p-3 text-sm ${
                    active
                      ? 'border-slate-300 bg-white text-slate-800'
                      : 'border-slate-100 bg-slate-100 text-slate-400'
                  }`}
                >
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs mt-1">{active ? 'Ruxsat bor' : "Ruxsat yo'q"}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Rollar ({roles.length})
          </h2>
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
      </main>
    </div>
  );
}
