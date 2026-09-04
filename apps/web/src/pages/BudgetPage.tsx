import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BudgetDto } from '../lib/types';

const MONTH_LABELS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

// Jadvaldagi bitta qator — barcha maydonlar matn (input qiymati), bo'sh satr
// "rejalashtirilmagan" degani. Backend'ga yuborishda bo'sh satr `null`ga
// aylantiriladi (DTO `@IsNumberString` bo'sh satrni qabul qilmaydi).
interface Row {
  month: number;
  roomsRevenue: string;
  occupancyRatePct: string;
  adr: string;
}

function emptyRows(): Row[] {
  return MONTH_LABELS.map((_, i) => ({
    month: i + 1,
    roomsRevenue: '',
    occupancyRatePct: '',
    adr: '',
  }));
}

function toInput(value: string | null): string {
  if (value === null) return '';
  // Backend numeric'ni "1000.00" ko'rinishida qaytaradi — ortiqcha nollarni
  // olib tashlaymiz, aks holda har ochilganda qiymat "o'zgargandek" ko'rinadi.
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : value;
}

export function BudgetPage() {
  const { property, can } = useAuth();
  const canEdit = can('accounting', 'edit');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    apiFetch<BudgetDto[]>(`/properties/${property.id}/budgets?year=${year}`)
      .then((budgets) => {
        const byMonth = new Map(budgets.map((b) => [b.month, b]));
        setRows(
          emptyRows().map((r) => {
            const b = byMonth.get(r.month);
            return b
              ? {
                  month: r.month,
                  roomsRevenue: toInput(b.roomsRevenue),
                  occupancyRatePct: toInput(b.occupancyRatePct),
                  adr: toInput(b.adr),
                }
              : r;
          }),
        );
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Budjetni yuklab bo'lmadi"),
      )
      .finally(() => setLoading(false));
  }, [property, year]);

  const updateRow = (month: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.month === month ? { ...r, ...patch } : r)),
    );
    setSaved(false);
  };

  // Yillik jami — kiritish paytida darhol ko'rinadi, xatoni sezish oson
  // bo'lishi uchun (masalan bir oyga nol ortiqcha qo'shilgani).
  const totalRevenue = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n = Number(r.roomsRevenue);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [rows],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/properties/${property.id}/budgets/${year}`, {
        method: 'PUT',
        body: JSON.stringify({
          months: rows.map((r) => ({
            month: r.month,
            roomsRevenue: r.roomsRevenue.trim() || null,
            occupancyRatePct: r.occupancyRatePct.trim() || null,
            adr: r.adr.trim() || null,
          })),
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <AppLayout title="Budjet">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="budget-year" className="text-sm text-slate-600">
            Yil
          </label>
          <select
            id="budget-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input w-32"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-600">
          Yillik daromad rejasi:{' '}
          <span className="font-semibold text-slate-900">
            {totalRevenue.toLocaleString('uz-UZ')} {property?.currency ?? ''}
          </span>
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : (
        <form onSubmit={submit}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Oy</th>
                  <th className="text-left px-4 py-2">Xona daromadi</th>
                  <th className="text-left px-4 py-2">Bandlik (%)</th>
                  <th className="text-left px-4 py-2">ADR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.month}>
                    <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap">
                      {MONTH_LABELS[r.month - 1]}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={!canEdit}
                        value={r.roomsRevenue}
                        onChange={(e) =>
                          updateRow(r.month, { roomsRevenue: e.target.value })
                        }
                        className="input"
                        placeholder="—"
                        aria-label={`${MONTH_LABELS[r.month - 1]} xona daromadi`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        inputMode="decimal"
                        disabled={!canEdit}
                        value={r.occupancyRatePct}
                        onChange={(e) =>
                          updateRow(r.month, { occupancyRatePct: e.target.value })
                        }
                        className="input"
                        placeholder="—"
                        aria-label={`${MONTH_LABELS[r.month - 1]} bandlik`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={!canEdit}
                        value={r.adr}
                        onChange={(e) => updateRow(r.month, { adr: e.target.value })}
                        className="input"
                        placeholder="—"
                        aria-label={`${MONTH_LABELS[r.month - 1]} ADR`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Bo'sh qoldirilgan ko'rsatkich rejalashtirilmagan deb hisoblanadi —
            faqat o'zingizga kerakli qatorlarni to'ldirsangiz ham bo'ladi.
          </p>

          {canEdit ? (
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              {saved && !saving && (
                <span className="text-sm text-emerald-700">Saqlandi</span>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Budjetni o'zgartirish uchun ruxsatingiz yo'q — faqat ko'rish mumkin.
            </p>
          )}
        </form>
      )}
    </AppLayout>
  );
}
