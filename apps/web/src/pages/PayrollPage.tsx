import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { PayrollRunDto, PayrollRunStatus, PayslipEntryDto } from '../lib/types';

// Payroll (Ish haqi) sahifasi (2026-09): har oy uchun bitta "run" — DRAFT
// (tahrirlash mumkin, soatlik xodimlarga soat/qo'shimcha kiritiladi) →
// FINALIZED (buxgalteriyaga 6109/2300 provodkasi yoziladi, endi tahrirlanmaydi)
// → PAID (2300/1000 provodkasi — majburiyat yopiladi). Davomat/ta'til moduli
// yo'q — soatlar qo'lda kiritiladi. Backend: payroll.controller.ts.

const MONTH_LABELS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const STATUS_LABELS: Record<PayrollRunStatus, string> = {
  draft: 'Qoralama',
  finalized: 'Yakunlangan',
  paid: "To'langan",
};

const STATUS_COLORS: Record<PayrollRunStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  finalized: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

function money(v: string): string {
  return Number(v).toLocaleString('uz-UZ');
}

function periodLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function PayrollPage() {
  const { property, can } = useAuth();
  const [runs, setRuns] = useState<PayrollRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit') || canCreate;
  const canApprove = can('payroll', 'approve');

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<PayrollRunDto[]>(`/properties/${property.id}/payroll-runs`);
      setRuns(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  return (
    <AppLayout title="Ish haqi (Payroll)">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Har oy uchun payroll yarating — oylik xodimlarning summasi avtomatik, soatlik xodimlarniki esa qo'lda
          kiritilgan soatlar asosida hisoblanadi. Yakunlangach, buxgalteriyaga avtomatik provodka yoziladi.
        </p>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
            + Yangi payroll
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-slate-500">Hali payroll yaratilmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Davr</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-right px-4 py-2">Jami summa</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailId(r.id)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {periodLabel(r.periodYear, r.periodMonth)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{money(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-xs text-brand-navy underline">Tafsilotlar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && property && (
        <CreateRunModal
          propertyId={property.id}
          onClose={() => setShowCreate(false)}
          onSaved={(id) => {
            setShowCreate(false);
            load();
            setDetailId(id);
          }}
        />
      )}

      {detailId && property && (
        <RunDetailModal
          propertyId={property.id}
          runId={detailId}
          canEdit={canEdit}
          canApprove={canApprove}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </AppLayout>
  );
}

function CreateRunModal({
  propertyId,
  onClose,
  onSaved,
}: {
  propertyId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const run = await apiFetch<PayrollRunDto>(`/properties/${propertyId}/payroll-runs`, {
        method: 'POST',
        body: JSON.stringify({ periodYear, periodMonth }),
      });
      onSaved(run.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Payroll yaratishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi payroll" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Oy</span>
            <select
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="input"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Yil</span>
            <input
              type="number"
              required
              min={2020}
              max={2100}
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="input"
            />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Yaratilmoqda...' : 'Payroll yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function RunDetailModal({
  propertyId,
  runId,
  canEdit,
  canApprove,
  onClose,
  onChanged,
}: {
  propertyId: string;
  runId: string;
  canEdit: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [run, setRun] = useState<PayrollRunDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    apiFetch<PayrollRunDto>(`/properties/${propertyId}/payroll-runs/${runId}`)
      .then(setRun)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Payrollni yuklashda xatolik'));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, runId]);

  const finalize = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/properties/${propertyId}/payroll-runs/${runId}/finalize`, { method: 'POST' });
      load();
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Yakunlashda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/properties/${propertyId}/payroll-runs/${runId}/mark-paid`, { method: 'POST' });
      load();
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "To'langan deb belgilashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Modal title="Payroll" onClose={onClose}>
        <p className="text-sm text-rose-600">{error}</p>
      </Modal>
    );
  }

  if (!run) {
    return (
      <Modal title="Payroll" onClose={onClose} width="max-w-3xl">
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Modal>
    );
  }

  const isDraft = run.status === 'draft';

  return (
    <Modal title={periodLabel(run.periodYear, run.periodMonth)} onClose={onClose} width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[run.status]}`}>
            {STATUS_LABELS[run.status]}
          </span>
          <p className="text-sm font-semibold text-slate-900">Jami: {money(run.totalAmount)}</p>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-3 py-1.5">Xodim</th>
                <th className="text-left px-3 py-1.5">Turi</th>
                <th className="text-right px-3 py-1.5">Stavka</th>
                <th className="text-right px-3 py-1.5">Soat</th>
                <th className="text-right px-3 py-1.5">Summa</th>
                <th className="text-right px-3 py-1.5">Tuzatish</th>
                <th className="text-right px-3 py-1.5">Netto</th>
                {isDraft && canEdit && <th className="px-3 py-1.5"></th>}
              </tr>
            </thead>
            <tbody>
              {(run.entries ?? []).map((entry) => (
                <PayslipEntryRow
                  key={entry.id}
                  propertyId={propertyId}
                  runId={runId}
                  entry={entry}
                  editable={isDraft && canEdit}
                  onSaved={() => {
                    load();
                    onChanged();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        {actionError && <p className="text-sm text-rose-600">{actionError}</p>}

        {canApprove && isDraft && (
          <button onClick={finalize} disabled={busy} className="btn-primary w-full">
            {busy ? 'Yakunlanmoqda...' : "Yakunlash (buxgalteriyaga provodka yoziladi)"}
          </button>
        )}
        {canApprove && run.status === 'finalized' && (
          <button onClick={markPaid} disabled={busy} className="btn-primary w-full">
            {busy ? 'Belgilanmoqda...' : "To'landi deb belgilash"}
          </button>
        )}
        {run.status === 'paid' && (
          <p className="text-xs text-slate-500">
            {run.paidAt && `To'langan sana: ${new Date(run.paidAt).toLocaleDateString('uz-UZ')}`}
          </p>
        )}
      </div>
    </Modal>
  );
}

function PayslipEntryRow({
  propertyId,
  runId,
  entry,
  editable,
  onSaved,
}: {
  propertyId: string;
  runId: string;
  entry: PayslipEntryDto;
  editable: boolean;
  onSaved: () => void;
}) {
  const isHourly = entry.salaryType === 'hourly';
  const [hoursWorked, setHoursWorked] = useState(entry.hoursWorked ?? '0');
  const [adjustmentAmount, setAdjustmentAmount] = useState(entry.adjustmentAmount);
  const [adjustmentNote, setAdjustmentNote] = useState(entry.adjustmentNote ?? '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setRowError(null);
    try {
      const body: Record<string, unknown> = {
        adjustmentAmount: Number(adjustmentAmount),
        adjustmentNote,
      };
      if (isHourly) body.hoursWorked = Number(hoursWorked);
      await apiFetch(`/properties/${propertyId}/payroll-runs/${runId}/entries/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      setRowError(e instanceof ApiError ? e.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-1.5">{entry.employeeNameSnapshot}</td>
      <td className="px-3 py-1.5">{isHourly ? 'Soatlik' : 'Oylik'}</td>
      <td className="px-3 py-1.5 text-right">{money(entry.rateSnapshot)}</td>
      <td className="px-3 py-1.5 text-right">
        {editable && isHourly ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={hoursWorked}
            onChange={(e) => {
              setHoursWorked(e.target.value);
              setDirty(true);
            }}
            className="input w-20 text-right py-1"
          />
        ) : isHourly ? (
          entry.hoursWorked
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-1.5 text-right">{money(entry.grossAmount)}</td>
      <td className="px-3 py-1.5 text-right">
        {editable ? (
          <div className="space-y-1">
            <input
              type="number"
              step="0.01"
              value={adjustmentAmount}
              onChange={(e) => {
                setAdjustmentAmount(e.target.value);
                setDirty(true);
              }}
              className="input w-24 text-right py-1"
            />
            <input
              type="text"
              maxLength={500}
              placeholder="Izoh"
              value={adjustmentNote}
              onChange={(e) => {
                setAdjustmentNote(e.target.value);
                setDirty(true);
              }}
              className="input w-32 py-1 text-xs"
            />
          </div>
        ) : (
          <>
            {money(entry.adjustmentAmount)}
            {entry.adjustmentNote && <p className="text-slate-400">{entry.adjustmentNote}</p>}
          </>
        )}
      </td>
      <td className="px-3 py-1.5 text-right font-medium text-slate-900">{money(entry.netAmount)}</td>
      {editable && (
        <td className="px-3 py-1.5 text-right">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="text-xs text-brand-navy underline disabled:text-slate-300 disabled:no-underline"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {rowError && <p className="text-rose-600 text-[11px] mt-0.5">{rowError}</p>}
        </td>
      )}
    </tr>
  );
}
