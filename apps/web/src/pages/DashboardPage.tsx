import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { LoyaltyTier, ReportsOverviewDto } from '../lib/types';

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: { module: string; action: string }[];
}

const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  platinum: 'Platina',
};

const TIER_BAR_COLORS: Record<LoyaltyTier, string> = {
  bronze: 'bg-amber-600',
  silver: 'bg-slate-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-cyan-500',
};

function money(n: number, currency: string): string {
  return `${n.toLocaleString('uz-UZ')} ${currency}`;
}

// Yengil, tashqi kutubxonasiz SVG ustunli grafik — daromad tendensiyasini
// ko'rsatish uchun (loyihada hozircha chart kutubxonasi o'rnatilmagan).
function RevenueTrendChart({ data, currency }: { data: { date: string; amount: number }[]; currency: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const width = 560;
  const height = 140;
  const barGap = 4;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36" role="img" aria-label="Daromad tendensiyasi">
      {data.map((d, i) => {
        const barHeight = Math.max(1, (d.amount / max) * (height - 20));
        const x = i * (barWidth + barGap);
        const y = height - barHeight - 16;
        const dayLabel = d.date.slice(8, 10);
        return (
          <g key={d.date}>
            <title>
              {d.date}: {money(d.amount, currency)}
            </title>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={2} className="fill-indigo-500" />
            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" className="fill-slate-400" fontSize={9}>
              {dayLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const MODULES = [
  { key: 'booking', label: 'Bron / Xona boshqaruvi', link: '/bookings' },
  { key: 'front_desk', label: 'Front Desk' },
  { key: 'housekeeping', label: 'Housekeeping', link: '/housekeeping' },
  { key: 'warehouse', label: 'Warehouse (Ombor)', link: '/warehouse' },
  { key: 'pos', label: 'POS', link: '/pos' },
  { key: 'guest_crm', label: 'Guest CRM / Loyalty', link: '/guests' },
  { key: 'invoicing', label: 'Invoicing', link: '/invoicing' },
  { key: 'accounting', label: 'Moliyaviy hisob (USALI)', link: '/accounting' },
  { key: 'reports', label: 'Hisobot / Dashboard' },
  { key: 'billing', label: 'SaaS Billing' },
];

export function DashboardPage() {
  const { user, property, permissions } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [overview, setOverview] = useState<ReportsOverviewDto | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.tenantId) return;
    apiFetch<Role[]>('/roles').then(setRoles).catch(() => {});
  }, [user?.tenantId]);

  const hasAccess = (moduleKey: string) => permissions.some((p) => p.startsWith(`${moduleKey}:`));

  useEffect(() => {
    if (!property || !hasAccess('reports')) return;
    setOverviewError(null);
    apiFetch<ReportsOverviewDto>(`/properties/${property.id}/reports/overview`)
      .then(setOverview)
      .catch(() => setOverviewError("Hisobotni yuklashda xatolik yuz berdi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const currency = property?.currency ?? 'UZS';

  return (
    <AppLayout title="Bosh sahifa">
      <div className="space-y-8">
        {hasAccess('reports') && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Bugungi holat</h2>
              {overview && <p className="text-xs text-slate-400">{overview.asOfDate} holatiga, oxirgi {overview.periodDays} kun bo'yicha KPI</p>}
            </div>
            {overviewError && <p className="text-sm text-red-600">{overviewError}</p>}
            {!overview && !overviewError && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
            {overview && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard
                    label="Bandlik"
                    value={`${overview.occupancy.occupancyRatePct}%`}
                    hint={`${overview.occupancy.occupiedRooms} / ${overview.occupancy.totalRooms} xona`}
                  />
                  <KpiCard label="ADR (o'rtacha kunlik narx)" value={money(overview.adr, currency)} />
                  <KpiCard label="RevPAR" value={money(overview.revPar, currency)} />
                  <KpiCard
                    label="Turgan mehmonlar"
                    value={String(overview.inHouseBookings)}
                    hint={`Bugun kelish: ${overview.todayArrivals} · Bugun ketish: ${overview.todayDepartures}`}
                  />
                  <KpiCard
                    label="To'lanmagan hisob-fakturalar"
                    value={money(overview.outstandingInvoices.totalBalance, currency)}
                    hint={`${overview.outstandingInvoices.count} ta hisob-faktura`}
                  />
                  <KpiCard label="Tozalash kutilmoqda" value={String(overview.housekeepingPending)} hint="Housekeeping vazifalari" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                  <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-900 mb-2">Daromad tendensiyasi (oxirgi 14 kun)</p>
                    <RevenueTrendChart data={overview.revenueTrend} currency={currency} />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-900 mb-3">Loyalty darajalari bo'yicha mehmonlar</p>
                    <div className="space-y-2">
                      {(() => {
                        const maxCount = Math.max(1, ...overview.loyaltyDistribution.map((d) => d.count));
                        return overview.loyaltyDistribution.map((d) => (
                          <div key={d.tier}>
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                              <span>{TIER_LABELS[d.tier]}</span>
                              <span>{d.count}</span>
                            </div>
                            <div className="h-2 rounded bg-slate-100">
                              <div
                                className={`h-2 rounded ${TIER_BAR_COLORS[d.tier]}`}
                                style={{ width: `${(d.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

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
