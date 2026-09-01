import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type {
  AccountDepartment,
  HousekeepingStatus,
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  IncomeStatementDto,
  LoyaltyTier,
  MaintenanceTicketDto,
  ReportsOverviewDto,
  RoomDto,
  RoomStatus,
} from '../lib/types';

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

const HK_STATUS_LABELS: Record<HousekeepingStatus, string> = {
  clean: 'Toza',
  dirty: 'Iflos',
  in_progress: 'Tozalanmoqda',
  inspected: 'Tekshirilgan',
};

const HK_STATUS_COLORS: Record<HousekeepingStatus, string> = {
  clean: 'bg-emerald-500',
  dirty: 'bg-rose-500',
  in_progress: 'bg-amber-500',
  inspected: 'bg-sky-500',
};

const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Bo'sh",
  occupied: 'Band',
  maintenance: "Ta'mirlashda",
  out_of_order: 'Ishlamaydi',
};

const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-brand-navy',
  maintenance: 'bg-amber-500',
  out_of_order: 'bg-rose-500',
};

const TASK_STATUS_LABELS: Record<HousekeepingTaskStatus, string> = {
  pending: 'Kutilmoqda',
  in_progress: 'Jarayonda',
  done: 'Bajarildi',
  inspected: 'Tekshirildi',
  cancelled: 'Bekor qilindi',
};

const TASK_STATUS_COLORS: Record<HousekeepingTaskStatus, string> = {
  pending: 'bg-amber-500',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  inspected: 'bg-indigo-500',
  cancelled: 'bg-slate-400',
};

const DEPT_BAR_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-lime-500',
];

const DEPARTMENT_LABELS: Record<AccountDepartment, string> = {
  rooms: 'Xonalar',
  food_beverage: 'Oziq-ovqat va ichimlik',
  other_operated: 'Boshqa operatsion',
  miscellaneous_income: 'Turli daromadlar',
  admin_general: "Ma'muriy va umumiy",
  info_telecom: 'Axborot va telekommunikatsiya',
  sales_marketing: 'Savdo va marketing',
  property_maintenance: "Mulkni ekspluatatsiya va ta'mirlash",
  energy_water_waste: 'Energiya, suv va chiqindi',
  payroll_related: "Ish haqi bilan bog'liq",
  management_fees: "Boshqaruv to'lovlari",
  nonoperating: "Operatsion bo'lmagan",
  undistributed_expenses: 'Taqsimlanmagan xarajatlar',
  fixed_charges: 'Doimiy xarajatlar',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function countByField<T extends string>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of items) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

// Bir xil uslubdagi gorizontal-panjara (bar) ro'yxati — Housekeeping va Moliyaviy
// tablarida taqsimotlarni ko'rsatish uchun (Umumiy tabdagi Loyalty taqsimoti bilan bir xil uslub).
function DistributionBars({
  rows,
}: {
  rows: { label: string; count: number; colorClass: string; valueLabel?: string }[];
}) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{r.label}</span>
            <span>{r.valueLabel ?? r.count}</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className={`h-2 rounded ${r.colorClass}`} style={{ width: `${(r.count / maxCount) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
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

// "Housekeeping" tabi — xonalar tozalik holati, vazifalar va ochiq texnik xizmat
// chiptalari bo'yicha KPI'lar. Mavjud /housekeeping/rooms, /housekeeping/tasks va
// /maintenance-tickets endpointlaridan olingan ro'yxatlarni mijoz tomonida yig'adi
// (alohida agregatsiya endpointi yo'q, tile hajmidagi ma'lumot uchun bu yetarli).
function HousekeepingTab({ propertyId }: { propertyId: string }) {
  const [rooms, setRooms] = useState<RoomDto[] | null>(null);
  const [tasks, setTasks] = useState<HousekeepingTaskDto[] | null>(null);
  const [openTickets, setOpenTickets] = useState<MaintenanceTicketDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      apiFetch<RoomDto[]>(`/properties/${propertyId}/housekeeping/rooms`),
      apiFetch<HousekeepingTaskDto[]>(`/properties/${propertyId}/housekeeping/tasks`),
      apiFetch<MaintenanceTicketDto[]>(`/properties/${propertyId}/maintenance-tickets?status=open`),
    ])
      .then(([r, t, m]) => {
        setRooms(r);
        setTasks(t);
        setOpenTickets(m);
      })
      .catch(() => setError("Housekeeping ma'lumotlarini yuklashda xatolik yuz berdi"));
  }, [propertyId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rooms || !tasks || !openTickets) return <p className="text-sm text-slate-400">Yuklanmoqda...</p>;

  const hkCounts = countByField(rooms.map((r) => r.housekeepingStatus));
  const roomStatusCounts = countByField(rooms.map((r) => r.status));
  const taskCounts = countByField(tasks.map((t) => t.status));
  const pendingTasks = (taskCounts.pending ?? 0) + (taskCounts.in_progress ?? 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Toza xonalar" value={String(hkCounts.clean ?? 0)} hint={`${rooms.length} tadan`} />
        <KpiCard label="Iflos xonalar" value={String(hkCounts.dirty ?? 0)} />
        <KpiCard label="Kutilayotgan vazifalar" value={String(pendingTasks)} hint="Housekeeping vazifalari" />
        <KpiCard label="Ochiq texnik xizmat chiptalari" value={String(openTickets.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900 mb-3">Xonalar holati (tozalik)</p>
          <DistributionBars
            rows={(Object.keys(HK_STATUS_LABELS) as HousekeepingStatus[]).map((k) => ({
              label: HK_STATUS_LABELS[k],
              count: hkCounts[k] ?? 0,
              colorClass: HK_STATUS_COLORS[k],
            }))}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900 mb-3">Xonalar holati (band/bo'sh)</p>
          <DistributionBars
            rows={(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((k) => ({
              label: ROOM_STATUS_LABELS[k],
              count: roomStatusCounts[k] ?? 0,
              colorClass: ROOM_STATUS_COLORS[k],
            }))}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 mt-3">
        <p className="text-sm font-medium text-slate-900 mb-3">Vazifalar holati</p>
        <DistributionBars
          rows={(Object.keys(TASK_STATUS_LABELS) as HousekeepingTaskStatus[]).map((k) => ({
            label: TASK_STATUS_LABELS[k],
            count: taskCounts[k] ?? 0,
            colorClass: TASK_STATUS_COLORS[k],
          }))}
        />
      </div>
    </>
  );
}

// "Moliyaviy / Rev Mgt" tabi — Umumiy tabda allaqachon yuklangan `overview`ni qayta
// ishlatadi (ADR/RevPAR/bandlik/to'lanmagan hisob-fakturalar), qo'shimcha ravishda
// joriy oy uchun USALI daromadlar hisobotini (accounting:view) yuklaydi.
function MoliyaviyTab({
  propertyId,
  currency,
  overview,
  overviewError,
  canAccounting,
}: {
  propertyId: string;
  currency: string;
  overview: ReportsOverviewDto | null;
  overviewError: string | null;
  canAccounting: boolean;
}) {
  const [income, setIncome] = useState<IncomeStatementDto | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const from = firstDayOfMonthIso();
  const to = todayIso();

  useEffect(() => {
    if (!canAccounting) return;
    setIncomeError(null);
    apiFetch<IncomeStatementDto>(`/properties/${propertyId}/accounting/income-statement?from=${from}&to=${to}`)
      .then(setIncome)
      .catch(() => setIncomeError("Daromadlar hisobotini yuklashda xatolik yuz berdi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, canAccounting]);

  const revenueTotal = income ? income.revenue.reduce((s, r) => s + Number(r.amount), 0) : null;
  const expenseTotal = income ? income.expense.reduce((s, r) => s + Number(r.amount), 0) : null;
  const netProfit = revenueTotal !== null && expenseTotal !== null ? revenueTotal - expenseTotal : null;

  const departmentTotals = (() => {
    if (!income) return [];
    const totals = new Map<string, number>();
    for (const row of income.revenue) {
      const key = row.department ?? 'boshqa';
      totals.set(key, (totals.get(key) ?? 0) + Number(row.amount));
    }
    return Array.from(totals.entries())
      .map(([dept, amount]) => ({
        label: dept === 'boshqa' ? 'Boshqa' : (DEPARTMENT_LABELS[dept as AccountDepartment] ?? dept),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  })();

  return (
    <>
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={`Bandlik (o'rtacha, ${overview.periodDays} kun)`}
            value={`${overview.occupancy.occupancyRatePct}%`}
          />
          <KpiCard label="ADR (o'rtacha kunlik narx)" value={money(overview.adr, currency)} />
          <KpiCard label="RevPAR" value={money(overview.revPar, currency)} />
          <KpiCard
            label="To'lanmagan hisob-fakturalar"
            value={money(overview.outstandingInvoices.totalBalance, currency)}
            hint={`${overview.outstandingInvoices.count} ta hisob-faktura`}
          />
        </div>
      )}
      {overviewError && <p className="text-sm text-red-600 mt-3">{overviewError}</p>}
      {!overview && !overviewError && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}

      {canAccounting && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900">Joriy oy (USALI daromadlar hisoboti)</h3>
            <p className="text-xs text-slate-400">
              {from} — {to}
            </p>
          </div>
          {incomeError && <p className="text-sm text-red-600">{incomeError}</p>}
          {!income && !incomeError && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
          {income && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard label="Daromad (oy boshidan)" value={money(revenueTotal ?? 0, currency)} />
                <KpiCard label="Xarajat (oy boshidan)" value={money(expenseTotal ?? 0, currency)} />
                <KpiCard label="Sof foyda" value={money(netProfit ?? 0, currency)} />
              </div>
              {departmentTotals.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 mt-3">
                  <p className="text-sm font-medium text-slate-900 mb-3">Bo'limlar bo'yicha daromad (USALI)</p>
                  <DistributionBars
                    rows={departmentTotals.map((d, i) => ({
                      label: d.label,
                      count: d.amount,
                      colorClass: DEPT_BAR_COLORS[i % DEPT_BAR_COLORS.length],
                      valueLabel: money(d.amount, currency),
                    }))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
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

type Tab = 'umumiy' | 'housekeeping' | 'moliyaviy';

const TAB_LABELS: Record<Tab, string> = {
  umumiy: 'Umumiy',
  housekeeping: 'Housekeeping',
  moliyaviy: 'Moliyaviy / Rev Mgt',
};

export function DashboardPage() {
  const { user, property, permissions } = useAuth();
  const [tab, setTab] = useState<Tab>('umumiy');
  const [roles, setRoles] = useState<Role[]>([]);
  const [overview, setOverview] = useState<ReportsOverviewDto | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const hasAccess = (moduleKey: string) => permissions.some((p) => p.startsWith(`${moduleKey}:`));

  useEffect(() => {
    if (!user?.tenantId || !hasAccess('users_roles')) return;
    apiFetch<Role[]>('/roles').then(setRoles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId, permissions]);

  useEffect(() => {
    if (!property || !hasAccess('reports')) return;
    setOverviewError(null);
    apiFetch<ReportsOverviewDto>(`/properties/${property.id}/reports/overview`)
      .then(setOverview)
      .catch(() => setOverviewError("Hisobotni yuklashda xatolik yuz berdi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const currency = property?.currency ?? 'UZS';

  // OPERA Cloud dashboard'idagi kabi — bo'limlar mazmuni bo'yicha guruhlangan tablar:
  // Umumiy (hamma uchun), Housekeeping va Moliyaviy/Rev Mgt faqat tegishli ruxsat
  // bor foydalanuvchilarga ko'rinadi.
  const visibleTabs: Tab[] = [
    'umumiy',
    ...(hasAccess('housekeeping') ? (['housekeeping'] as const) : []),
    ...(hasAccess('reports') || hasAccess('accounting') ? (['moliyaviy'] as const) : []),
  ];
  const activeTab = visibleTabs.includes(tab) ? tab : 'umumiy';

  return (
    <AppLayout title="Bosh sahifa">
      <div className="flex gap-6 border-b border-slate-200 mb-6">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative pb-3 pt-1 text-sm font-medium transition-colors ${
              activeTab === t ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
            {activeTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-navy" />}
          </button>
        ))}
      </div>

      {activeTab === 'umumiy' && (
        <div className="space-y-8">
          {hasAccess('reports') && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Bugungi holat</h2>
                {overview && (
                  <p className="text-xs text-slate-400">
                    {overview.asOfDate} holatiga, oxirgi {overview.periodDays} kun bo'yicha KPI
                  </p>
                )}
              </div>
              {overviewError && <p className="text-sm text-red-600">{overviewError}</p>}
              {!overview && !overviewError && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
              {overview && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      label={`Bandlik (o'rtacha, ${overview.periodDays} kun)`}
                      value={`${overview.occupancy.occupancyRatePct}%`}
                      hint={`hozir: ${overview.occupancy.occupiedRooms} / ${overview.occupancy.totalRooms} xona band`}
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

          {hasAccess('users_roles') && (
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
          )}
        </div>
      )}

      {activeTab === 'housekeeping' && property && (
        <div className="space-y-3">
          <HousekeepingTab propertyId={property.id} />
        </div>
      )}

      {activeTab === 'moliyaviy' && property && (
        <div className="space-y-3">
          <MoliyaviyTab
            propertyId={property.id}
            currency={currency}
            overview={hasAccess('reports') ? overview : null}
            overviewError={hasAccess('reports') ? overviewError : null}
            canAccounting={hasAccess('accounting')}
          />
        </div>
      )}
    </AppLayout>
  );
}
