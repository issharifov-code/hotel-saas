import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type {
  AccountDepartment,
  BudgetPerformanceDto,
  HousekeepingStatus,
  InsightDto,
  InsightSeverity,
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  IncomeStatementDto,
  LoyaltyTier,
  MaintenanceTicketDto,
  ReportsOverviewDto,
  RoomDto,
  RoomStatus,
} from '../lib/types';

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

// Yengil, tashqi kutubxonasiz SVG ustunli grafik — trend metrikalarini
// ko'rsatish uchun (loyihada hozircha chart kutubxonasi o'rnatilmagan).
// 2026-09: `RevenueTrendChart`dan umumlashtirildi — endi Revenue/ADR/
// Occupancy'ning har biri uchun qayta ishlatiladi (`RevenueChartCard`ga
// qarang), qiymatni formatlash `formatTooltip` orqali chaqiruvchiga beriladi.
function TrendChart({
  data,
  formatTooltip,
}: {
  data: { date: string; value: number }[];
  formatTooltip: (date: string, value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 560;
  const height = 140;
  const barGap = 4;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36" role="img" aria-label="Trend grafigi">
      {data.map((d, i) => {
        const barHeight = Math.max(1, (d.value / max) * (height - 20));
        const x = i * (barWidth + barGap);
        const y = height - barHeight - 16;
        const dayLabel = d.date.slice(8, 10);
        return (
          <g key={d.date}>
            <title>{formatTooltip(d.date, d.value)}</title>
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

type ChartMetric = 'revenue' | 'adr' | 'occupancy';

const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: 'Daromad',
  adr: 'ADR',
  occupancy: 'Bandlik',
};

// Daromad tendensiyasi grafigi (2026-09, wireframe fikr-mulohazasi asosida):
// avvalgi faqat-daromad bar chart o'rniga endi Revenue/ADR/Occupancy
// o'rtasida almashtirgich — backend allaqachon uchala trend massivini ham
// qaytaradi (`overview.revenueTrend/adrTrend/occupancyTrend`).
function RevenueChartCard({ overview, currency }: { overview: ReportsOverviewDto; currency: string }) {
  const [metric, setMetric] = useState<ChartMetric>('revenue');

  const data: { date: string; value: number }[] =
    metric === 'revenue'
      ? overview.revenueTrend.map((d) => ({ date: d.date, value: d.amount }))
      : metric === 'adr'
        ? overview.adrTrend.map((d) => ({ date: d.date, value: d.adr }))
        : overview.occupancyTrend.map((d) => ({ date: d.date, value: d.occupancyRatePct }));

  const formatTooltip = (date: string, value: number) =>
    metric === 'occupancy' ? `${date}: ${value}%` : `${date}: ${money(value, currency)}`;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-sm font-medium text-slate-900">Daromad tendensiyasi (oxirgi 14 kun)</p>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5">
          {(Object.keys(CHART_METRIC_LABELS) as ChartMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                metric === m ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-navy'
              }`}
            >
              {CHART_METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <TrendChart data={data} formatTooltip={formatTooltip} />
    </div>
  );
}

// Loyalty taqsimoti paneli (2026-09): avvalgi versiyada raqamlar (40/25/12/3)
// nimani anglatishi (son? foiz?) darhol bilinmasdi — endi sarlavhada jami
// mehmonlar soni, har bir daraja qatorida esa son VA umumiy foiz ko'rsatiladi.
function LoyaltyPanel({ distribution }: { distribution: { tier: LoyaltyTier; count: number }[] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-sm font-medium text-slate-900">Loyalty darajalari</p>
      <p className="text-xs text-slate-400 mb-3">{total} mehmon</p>
      <div className="space-y-2">
        {distribution.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.tier}>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{TIER_LABELS[d.tier]}</span>
                <span>
                  {d.count} mehmon <span className="text-slate-400">· {pct}%</span>
                </span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className={`h-2 rounded ${TIER_BAR_COLORS[d.tier]}`}
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Trend strelkasi (2026-09) — backend `ReportsOverviewDto.trend`dan kelgan
// nisbiy foiz o'zgarishni ko'rsatadi (bevosita oldingi, xuddi shunday
// uzunlikdagi davrga solishtirib). `null` bo'lsa (oldingi davrda ma'lumot
// yo'q — masalan yangi mehmonxona) hech narsa ko'rsatilmaydi.
function TrendBadge({ deltaPct }: { deltaPct: number | null | undefined }) {
  if (deltaPct === null || deltaPct === undefined) return null;
  const up = deltaPct >= 0;
  return (
    <p className={`text-xs font-medium mt-1 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(deltaPct)}%{' '}
      <span className="font-normal text-slate-400">oldingi davrga nisbatan</span>
    </p>
  );
}

function KpiCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
      <TrendBadge deltaPct={trend} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// "Bugungi operatsiyalar" tez-nazar qatori (2026-09) — Umumiy tabda
// allaqachon yuklangan `overview`dan (kelish/ketish/tozalash/to'lovlar)
// foydalanadi, qo'shimcha backend endpoint kerak emas. Yuqoridagi kattaroq
// KPI kartalaridan farqli, bir qatorli ixcham ko'rinish uchun.
function TodaysOperationsStrip({ overview }: { overview: ReportsOverviewDto }) {
  const stats = [
    { label: 'Bugungi kelishlar', value: overview.todayArrivals },
    { label: 'Bugungi ketishlar', value: overview.todayDepartures },
    { label: 'Tozalash kutilmoqda', value: overview.housekeepingPending },
    { label: "To'lovlar kutilmoqda", value: overview.outstandingInvoices.count },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-sm font-medium text-slate-900 mb-3">Bugungi operatsiyalar</p>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-[120px]">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
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

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!rooms || !tasks || !openTickets) return <p className="text-sm text-slate-500">Yuklanmoqda...</p>;

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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <p className="text-sm font-medium text-slate-900 mb-3">Xonalar holati (tozalik)</p>
          <DistributionBars
            rows={(Object.keys(HK_STATUS_LABELS) as HousekeepingStatus[]).map((k) => ({
              label: HK_STATUS_LABELS[k],
              count: hkCounts[k] ?? 0,
              colorClass: HK_STATUS_COLORS[k],
            }))}
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 mt-3">
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

// "Front Desk" tabi (2026-09, OPERA Cloud'dagi "Default" tabidagi In
// House/Arrivals/Departures panellariga o'xshab) — Umumiy tabda allaqachon
// yuklangan `overview`dan bugungi kelish/ketish va turgan mehmonlar sonini
// alohida, kattaroq panellarda ko'rsatadi. Yangi backend endpoint kerak
// emas — bir xil `overview` obyekti qayta ishlatiladi (MoliyaviyTab'dagi
// naqsh bilan bir xil).
function FrontDeskTab({
  overview,
  overviewError,
}: {
  overview: ReportsOverviewDto | null;
  overviewError: string | null;
}) {
  if (overviewError) return <p className="text-sm text-rose-600">{overviewError}</p>;
  if (!overview) return <p className="text-sm text-slate-500">Yuklanmoqda...</p>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-sm font-medium text-slate-900 mb-2">Turgan mehmonlar (In House)</p>
          <p className="text-3xl font-semibold text-slate-900">{overview.occupancy.occupiedRooms}</p>
          <p className="text-xs text-slate-500 mt-1">
            {overview.occupancy.totalRooms} xonadan band · {overview.inHouseBookings} bron
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-sm font-medium text-slate-900 mb-2">Bugungi kelishlar (Arrivals)</p>
          <p className="text-3xl font-semibold text-slate-900">{overview.todayArrivals}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-sm font-medium text-slate-900 mb-2">Bugungi ketishlar (Departures)</p>
          <p className="text-3xl font-semibold text-slate-900">{overview.todayDepartures}</p>
        </div>
      </div>
      <Link
        to="/bookings"
        className="inline-block mt-4 text-sm font-medium text-brand-navy hover:underline"
      >
        Bronlar taqvimini ko'rish →
      </Link>
    </>
  );
}

// "FolioOne Intelligence" — qoidaga asoslangan tavsiyalar paneli.
// Har bir tavsiya nega chiqqanini aniq raqam bilan tushuntiradi, shuning
// uchun menejer uni tekshirib, ishonishi mumkin (backend izohiga qarang).
const INSIGHT_STYLES: Record<
  InsightSeverity,
  { dot: string; label: string; labelClass: string }
> = {
  critical: { dot: 'bg-rose-500', label: 'Muhim', labelClass: 'text-rose-700' },
  warning: { dot: 'bg-amber-500', label: 'Diqqat', labelClass: 'text-amber-700' },
  info: { dot: 'bg-sky-500', label: "Ma'lumot", labelClass: 'text-sky-700' },
  positive: { dot: 'bg-emerald-500', label: 'Yaxshi', labelClass: 'text-emerald-700' },
};

function InsightsCard({ insights }: { insights: InsightDto[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">FolioOne Intelligence</h3>
        <span className="text-xs text-slate-400">
          {insights.length > 0 ? `${insights.length} ta tavsiya` : ''}
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">
          Hozircha e'tibor talab qiladigan holat yo'q — ko'rsatkichlar barqaror.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {insights.map((i) => {
            const style = INSIGHT_STYLES[i.severity];
            return (
              <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-medium text-slate-900">{i.title}</p>
                      <span className={`text-[11px] font-medium ${style.labelClass}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{i.detail}</p>
                    {i.actionTo && i.actionLabel && (
                      <Link
                        to={i.actionTo}
                        className="mt-1.5 inline-block text-xs font-medium text-brand-navy hover:underline"
                      >
                        {i.actionLabel} →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const MONTH_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
];

type BudgetMetric = 'revenue' | 'occupancy' | 'adr';

const BUDGET_METRIC_LABELS: Record<BudgetMetric, string> = {
  revenue: 'Daromad',
  occupancy: 'Bandlik',
  adr: 'ADR',
};

// "Reja vs haqiqat" — oylik budjet va haqiqiy natija yonma-yon.
// Kutubxonasiz SVG (loyihada chart kutubxonasi yo'q, TrendChart bilan bir xil
// yondashuv), lekin bu yerda har oyda IKKITA ustun: reja va haqiqat.
function BudgetVsActualCard({
  data,
  currency,
}: {
  data: BudgetPerformanceDto;
  currency: string;
}) {
  const [metric, setMetric] = useState<BudgetMetric>('revenue');

  const pick = (m: BudgetPerformanceDto['months'][number]) => {
    if (metric === 'revenue')
      return { budget: m.budget.roomsRevenue, actual: m.actual.roomsRevenue };
    if (metric === 'occupancy')
      return {
        budget: m.budget.occupancyRatePct,
        actual: m.actual.occupancyRatePct,
      };
    return { budget: m.budget.adr, actual: m.actual.adr };
  };

  const format = (v: number) =>
    metric === 'occupancy'
      ? `${v.toLocaleString('uz-UZ')}%`
      : `${Math.round(v).toLocaleString('uz-UZ')} ${currency}`;

  const rows = data.months.map((m) => ({ month: m.month, isPartial: m.isPartial, isFuture: m.isFuture, ...pick(m) }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget ?? 0, r.actual]));

  // Yillik jamlanma — faqat daromad uchun mazmunli (yig'indi ko'rsatkich).
  // Bandlik/ADR o'rtacha bo'lgani uchun ularni qo'shib bo'lmaydi.
  const totalBudget = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const hasAnyBudget = rows.some((r) => r.budget !== null);

  // viewBox nisbati kartaning shakliga yaqin bo'lishi kerak — aks holda SVG
  // `w-full` bo'lsa ham o'rtada qolib, chap/o'ngda bo'sh joy qoladi.
  const width = 1200;
  const height = 170;
  const groupGap = 8;
  const groupWidth = (width - groupGap * 11) / 12;
  const barWidth = groupWidth / 2 - 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Reja vs haqiqat — {data.year}
          </h3>
          {metric === 'revenue' && hasAnyBudget && (
            <p className="mt-0.5 text-xs text-slate-500">
              Yillik reja {Math.round(totalBudget).toLocaleString('uz-UZ')} · haqiqat{' '}
              {Math.round(totalActual).toLocaleString('uz-UZ')} {currency}
            </p>
          )}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          {(Object.keys(BUDGET_METRIC_LABELS) as BudgetMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                metric === m
                  ? 'chip-active'
                  : 'text-slate-600 hover:bg-brand-navy-light hover:text-brand-navy'
              }`}
            >
              {BUDGET_METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {!hasAnyBudget ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {data.year}-yil uchun reja kiritilmagan —{' '}
          <Link to="/budget" className="text-brand-navy underline">
            Budjet
          </Link>{' '}
          sahifasidan kiritishingiz mumkin.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44"
            role="img"
            aria-label="Reja va haqiqat taqqoslash grafigi"
          >
            {rows.map((r, i) => {
              const x = i * (groupWidth + groupGap);
              const budgetH = r.budget !== null ? Math.max(1, (r.budget / max) * (height - 26)) : 0;
              const actualH = Math.max(r.actual > 0 ? 1 : 0, (r.actual / max) * (height - 26));
              return (
                <g key={r.month}>
                  {r.budget !== null && (
                    <>
                      <title>{`${MONTH_SHORT[r.month - 1]} reja: ${format(r.budget)}`}</title>
                      <rect
                        x={x}
                        y={height - budgetH - 18}
                        width={barWidth}
                        height={budgetH}
                        rx={2}
                        className="fill-slate-300"
                      />
                    </>
                  )}
                  {!r.isFuture && (
                    <g>
                      <title>
                        {`${MONTH_SHORT[r.month - 1]} haqiqat: ${format(r.actual)}${r.isPartial ? ' (oy tugamagan)' : ''}`}
                      </title>
                      <rect
                        x={x + barWidth + 2}
                        y={height - actualH - 18}
                        width={barWidth}
                        height={actualH}
                        rx={2}
                        // Tugamagan oy — ochroq rang, chunki uni to'liq oy
                        // rejasi bilan solishtirish adolatsiz.
                        className={r.isPartial ? 'fill-brand-navy/40' : 'fill-brand-navy'}
                      />
                    </g>
                  )}
                  <text
                    x={x + groupWidth / 2}
                    y={height - 4}
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize={9}
                  >
                    {MONTH_SHORT[r.month - 1]}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" /> Reja
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-navy" /> Haqiqat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-navy/40" /> Joriy oy (tugamagan)
            </span>
          </div>
        </>
      )}
    </div>
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
  // "Reja vs haqiqat" — budjet ma'lumotini oshkor qilgani uchun endpoint ham
  // accounting:view talab qiladi, ya'ni income-statement bilan bir xil shart.
  const [budgetPerf, setBudgetPerf] = useState<BudgetPerformanceDto | null>(null);
  const from = firstDayOfMonthIso();
  const to = todayIso();

  useEffect(() => {
    if (!canAccounting) return;
    setIncomeError(null);
    apiFetch<IncomeStatementDto>(`/properties/${propertyId}/accounting/income-statement?from=${from}&to=${to}`)
      .then(setIncome)
      .catch(() => setIncomeError("Daromadlar hisobotini yuklashda xatolik yuz berdi"));
    // Grafik ikkinchi darajali — yuklanmasa butun tabni xato bilan
    // to'ldirmaymiz, shunchaki ko'rsatmaymiz.
    apiFetch<BudgetPerformanceDto>(`/properties/${propertyId}/reports/budget-performance`)
      .then(setBudgetPerf)
      .catch(() => setBudgetPerf(null));
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
            trend={overview.trend.occupancyRatePctDelta}
          />
          <KpiCard
            label="ADR (o'rtacha kunlik narx)"
            value={money(overview.adr, currency)}
            trend={overview.trend.adrDelta}
          />
          <KpiCard label="RevPAR" value={money(overview.revPar, currency)} trend={overview.trend.revParDelta} />
          <KpiCard
            label="To'lanmagan hisob-fakturalar"
            value={money(overview.outstandingInvoices.totalBalance, currency)}
            hint={`${overview.outstandingInvoices.count} ta hisob-faktura`}
          />
        </div>
      )}
      {overviewError && <p className="text-sm text-rose-600 mt-3">{overviewError}</p>}
      {!overview && !overviewError && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}

      {canAccounting && budgetPerf && (
        <div className="mt-3">
          <BudgetVsActualCard data={budgetPerf} currency={currency} />
        </div>
      )}

      {canAccounting && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900">Joriy oy (USALI daromadlar hisoboti)</h3>
            <p className="text-xs text-slate-400">
              {from} — {to}
            </p>
          </div>
          {incomeError && <p className="text-sm text-rose-600">{incomeError}</p>}
          {!income && !incomeError && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
          {income && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard label="Daromad (oy boshidan)" value={money(revenueTotal ?? 0, currency)} />
                <KpiCard label="Xarajat (oy boshidan)" value={money(expenseTotal ?? 0, currency)} />
                <KpiCard label="Sof foyda" value={money(netProfit ?? 0, currency)} />
              </div>
              {departmentTotals.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 mt-3">
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

// "Modullar" ilova-ishga-tushirgich ikonkalari (2026-09) — minimal chiziqli
// uslub, AppLayout'dagi mavjud icon'lar bilan bir xil (viewBox 20x20,
// strokeWidth ~1.8).
function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 2.5a4 4 0 0 1 4 4v2.3c0 1 .4 1.9 1.1 2.6l.5.5c.5.5.1 1.4-.6 1.4H5c-.7 0-1.1-.9-.6-1.4l.5-.5c.7-.7 1.1-1.6 1.1-2.6V6.5a4 4 0 0 1 4-4Z"
      />
      <path strokeLinecap="round" d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

function BroomIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l4 4-7 7-4-1 1-4 6-6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11 3.5 16.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 17.5l1-2.7 1.7 1.7-2.7 1Z" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2.3" y="5.5" width="15.4" height="9" rx="1.8" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 16.5v-11M3.5 16.5h13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 13.5v-3M10 13.5v-6M13.5 13.5v-4.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="7.2" cy="6.5" r="2.5" />
      <path strokeLinecap="round" d="M2.5 16c0-2.6 2.1-4.3 4.7-4.3s4.7 1.7 4.7 4.3" />
      <circle cx="14" cy="7.2" r="2" />
      <path strokeLinecap="round" d="M13 11.9c1.9.2 3.5 1.7 3.5 4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4.5" width="14" height="12" rx="1.8" />
      <path strokeLinecap="round" d="M3 8.5h14M6.5 2.5v3M13.5 2.5v3" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5 17 6v8l-7 3.5L3 14V6l7-3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l7 3.5L17 6M10 9.5V17.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 3.5h2l1.7 9.3a1.8 1.8 0 0 0 1.8 1.5h6.3a1.8 1.8 0 0 0 1.8-1.5l1.1-6H5.5"
      />
      <circle cx="8" cy="17" r="1.1" />
      <circle cx="14.5" cy="17" r="1.1" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 2.5h10v15l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3-1.5-1.3L5 17.5v-15Z" />
      <path strokeLinecap="round" d="M7.3 6.5h5.4M7.3 9.5h5.4M7.3 12.5h3" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.8" />
      <path strokeLinecap="round" d="M2.5 8h15" />
      <path strokeLinecap="round" d="M5 12.5h3" />
    </svg>
  );
}

// "Modullar" — ilova-ishga-tushirgich (app launcher) ro'yxati (2026-09,
// wireframe fikr-mulohazasi asosida qayta ishlandi): avvalgi versiyada har
// bir modul "Ruxsat bor/yo'q" matni bilan generic admin-panel ko'rinishida
// edi — endi faqat foydalanuvchiga ochiq modullar, ikonka+qisqa tavsif bilan,
// haqiqiy ilova ishga tushirgichiga o'xshab ko'rsatiladi (ruxsat yo'q
// modullar butunlay yashiriladi, "qulflangan" plitkalar bilan chalg'itish
// o'rniga).
const MODULES: { key: string; label: string; subtitle: string; link: string; icon: () => React.JSX.Element }[] = [
  { key: 'front_desk', label: 'Front Desk', subtitle: 'Operatsiyalar', link: '/night-audit', icon: BellIcon },
  { key: 'housekeeping', label: 'Housekeeping', subtitle: 'Xona holati', link: '/housekeeping', icon: BroomIcon },
  { key: 'accounting', label: 'Moliyaviy hisob', subtitle: 'USALI', link: '/accounting', icon: CashIcon },
  { key: 'reports', label: 'Hisobotlar', subtitle: 'Dashboard', link: '/segment-reports', icon: ChartIcon },
  { key: 'guest_crm', label: 'Mijozlar', subtitle: 'CRM / Loyalty', link: '/guests', icon: UsersIcon },
  { key: 'booking', label: 'Bronlar', subtitle: 'Xona boshqaruvi', link: '/bookings', icon: CalendarIcon },
  { key: 'warehouse', label: 'Ombor', subtitle: 'Warehouse', link: '/warehouse', icon: BoxIcon },
  { key: 'pos', label: 'POS', subtitle: 'Savdo nuqtasi', link: '/pos', icon: CartIcon },
  { key: 'invoicing', label: 'Hisob-fakturalar', subtitle: 'Invoicing', link: '/invoicing', icon: ReceiptIcon },
  { key: 'billing', label: 'Obuna', subtitle: "To'lovlar", link: '/billing', icon: CardIcon },
];

function ModuleTile({
  label,
  subtitle,
  link,
  icon: Icon,
}: {
  label: string;
  subtitle: string;
  link: string;
  icon: () => React.JSX.Element;
}) {
  return (
    <Link
      to={link}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 transition-shadow hover:shadow-md hover:border-brand-navy/30"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy-light text-brand-navy">
        <Icon />
      </span>
      <span className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </span>
    </Link>
  );
}

type Tab = 'umumiy' | 'front_desk' | 'housekeeping' | 'moliyaviy';

const TAB_LABELS: Record<Tab, string> = {
  umumiy: 'Umumiy',
  front_desk: 'Front Desk',
  housekeeping: 'Housekeeping',
  moliyaviy: 'Moliyaviy / Rev Mgt',
};

export function DashboardPage() {
  const { user, property, permissions, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('umumiy');
  const [overview, setOverview] = useState<ReportsOverviewDto | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  // Tavsiyalar paneli — ikkinchi darajali: yuklanmasa Dashboard'ni xato
  // bilan to'ldirmaymiz, shunchaki ko'rsatmaymiz.
  const [insights, setInsights] = useState<InsightDto[] | null>(null);

  const hasAccess = (moduleKey: string) => permissions.some((p) => p.startsWith(`${moduleKey}:`));

  useEffect(() => {
    // Front Desk tabi ham shu `overview`dan foydalanadi (kelish/ketish/
    // turgan mehmonlar sonlari) — shuning uchun `front_desk` ruxsati bo'lgan,
    // lekin `reports` ruxsati bo'lmagan foydalanuvchi uchun ham yuklanadi.
    if (!property || !(hasAccess('reports') || hasAccess('front_desk'))) return;
    setOverviewError(null);
    apiFetch<ReportsOverviewDto>(`/properties/${property.id}/reports/overview`)
      .then(setOverview)
      .catch(() => setOverviewError("Hisobotni yuklashda xatolik yuz berdi"));
    if (hasAccess('reports')) {
      apiFetch<InsightDto[]>(`/properties/${property.id}/reports/insights`)
        .then(setInsights)
        .catch(() => setInsights(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const currency = property?.currency ?? 'UZS';

  // OPERA Cloud dashboard'idagi kabi — bo'limlar mazmuni bo'yicha guruhlangan
  // 4 ta tab: Umumiy (hamma uchun), Front Desk, Housekeeping va Moliyaviy/Rev
  // Mgt faqat tegishli ruxsat bor foydalanuvchilarga ko'rinadi.
  const visibleTabs: Tab[] = [
    'umumiy',
    ...(hasAccess('front_desk') ? (['front_desk'] as const) : []),
    ...(hasAccess('housekeeping') ? (['housekeeping'] as const) : []),
    ...(hasAccess('reports') || hasAccess('accounting') ? (['moliyaviy'] as const) : []),
  ];
  const activeTab = visibleTabs.includes(tab) ? tab : 'umumiy';

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || user?.email;

  return (
    <AppLayout title="Bosh sahifa">
      {/* OPERA Cloud'dagi "Hello, {ism}!" salomlashuvi (2026-09), 2026-09
          (ixchamlashtirish): avvalgi ikki qatorli (sarlavha + alohida
          "Siz emasmisiz?" qatori) blok bitta qatorga siqildi — foydalanuvchi
          fikri: dashboard yuqorisida ortiqcha bo'sh joy KPI'larni pastga
          surib yubormasligi kerak. Chiqish havolasi endi kichik/subtle,
          ism yonida. */}
      <div className="mb-4 flex items-baseline gap-3 flex-wrap">
        <p className="text-xl font-semibold text-slate-900">Salom, {firstName}!</p>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-slate-400 hover:text-brand-navy hover:underline"
        >
          Tizimdan chiqish
        </button>
      </div>

      {/* Tab-qatori (2026-09, Login sahifasiga moslab): pastki-chiziqli
          tablar o'rniga Login'dagi pill tugmalar uslubiga mos yumaloq
          segmentli tanlagich — konteyner rounded-full, faol tab `.chip-active`
          (atrofi + yengil fon, to'liq brand-navy EMAS, qarang index.css). */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white p-1 mb-4 shadow-sm">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              activeTab === t ? 'chip-active' : 'text-slate-600 hover:bg-brand-navy-light hover:text-brand-navy'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {activeTab === 'umumiy' && (
        <div className="space-y-8">
          {hasAccess('reports') && insights !== null && (
            <InsightsCard insights={insights} />
          )}
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
              {overviewError && <p className="text-sm text-rose-600">{overviewError}</p>}
              {!overview && !overviewError && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
              {overview && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      label={`Bandlik (o'rtacha, ${overview.periodDays} kun)`}
                      value={`${overview.occupancy.occupancyRatePct}%`}
                      hint={`hozir: ${overview.occupancy.occupiedRooms} / ${overview.occupancy.totalRooms} xona band`}
                      trend={overview.trend.occupancyRatePctDelta}
                    />
                    <KpiCard
                      label="ADR (o'rtacha kunlik narx)"
                      value={money(overview.adr, currency)}
                      trend={overview.trend.adrDelta}
                    />
                    <KpiCard label="RevPAR" value={money(overview.revPar, currency)} trend={overview.trend.revParDelta} />
                    <KpiCard
                      label="Turgan mehmonlar"
                      value={String(overview.inHouseBookings)}
                      hint={`Bugun kelish: ${overview.todayArrivals} · Bugun ketish: ${overview.todayDepartures}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                    <RevenueChartCard overview={overview} currency={currency} />
                    <LoyaltyPanel distribution={overview.loyaltyDistribution} />
                  </div>

                  <div className="mt-3">
                    <TodaysOperationsStrip overview={overview} />
                  </div>
                </>
              )}
            </section>
          )}

          {MODULES.some((m) => hasAccess(m.key)) && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Modullar</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {MODULES.filter((m) => hasAccess(m.key)).map((m) => (
                  <ModuleTile key={m.key} label={m.label} subtitle={m.subtitle} link={m.link} icon={m.icon} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {activeTab === 'front_desk' && property && (
        <div className="space-y-3">
          <FrontDeskTab overview={overview} overviewError={overviewError} />
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
