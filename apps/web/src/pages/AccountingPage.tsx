import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  AccountDepartment,
  AccountDto,
  AccountType,
  IncomeStatementDto,
  JournalEntryDto,
  JournalEntrySourceModule,
  TrialBalanceRow,
} from '../lib/types';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Aktiv',
  liability: 'Passiv',
  equity: 'Kapital',
  revenue: 'Daromad',
  expense: 'Xarajat',
};

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

const SOURCE_MODULE_LABELS: Record<JournalEntrySourceModule, string> = {
  invoicing: 'Hisob-faktura',
  pos: 'POS',
  warehouse: 'Ombor',
  manual: "Qo'lda",
};

type View = 'accounts' | 'journal' | 'trial-balance' | 'income-statement';

const VIEW_LABELS: Record<View, string> = {
  accounts: 'Hisoblar rejasi',
  journal: 'Jurnal yozuvlari',
  'trial-balance': 'Aylanma-saldo',
  'income-statement': 'Daromadlar hisoboti',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function AccountingPage() {
  const { property, can } = useAuth();
  const [view, setView] = useState<View>('accounts');
  const canCreate = can('accounting', 'create');

  return (
    <AppLayout title="Moliyaviy hisob (USALI)">
      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === v ? 'bg-brand-navy text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {!property ? (
        <p className="text-sm text-slate-500">Mulk tanlanmagan</p>
      ) : view === 'accounts' ? (
        <AccountsView propertyId={property.id} />
      ) : view === 'journal' ? (
        <JournalEntriesView propertyId={property.id} canCreate={canCreate} />
      ) : view === 'trial-balance' ? (
        <TrialBalanceView propertyId={property.id} />
      ) : (
        <IncomeStatementView propertyId={property.id} />
      )}
    </AppLayout>
  );
}

function AccountsView({ propertyId }: { propertyId: string }) {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<AccountDto[]>(`/properties/${propertyId}/accounting/accounts`)
      .then(setAccounts)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <p className="text-sm text-slate-500">Yuklanmoqda...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
      {accounts.length === 0 && <p className="p-4 text-sm text-slate-500">Hisoblar topilmadi</p>}
      {accounts.map((a) => (
        <div key={a.id} className="p-3 flex items-center justify-between text-sm">
          <div>
            <p className="font-medium text-slate-900">
              {a.code} · {a.name}
              {!a.isActive && <span className="ml-2 text-xs text-slate-400">(nofaol)</span>}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ACCOUNT_TYPE_LABELS[a.type]}
              {a.department && <> · {DEPARTMENT_LABELS[a.department] ?? a.department}</>}
            </p>
          </div>
          <span className="text-xs text-slate-400 uppercase">{a.normalBalance === 'debit' ? 'Debet' : 'Kredit'}</span>
        </div>
      ))}
    </div>
  );
}

function JournalEntriesView({ propertyId, canCreate }: { propertyId: string; canCreate: boolean }) {
  const [entries, setEntries] = useState<JournalEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceModule, setSourceModule] = useState<'' | JournalEntrySourceModule>('');
  const [showNewEntry, setShowNewEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (sourceModule) params.set('sourceModule', sourceModule);
      const qs = params.toString();
      const list = await apiFetch<JournalEntryDto[]>(
        `/properties/${propertyId}/accounting/journal-entries${qs ? `?${qs}` : ''}`,
      );
      setEntries(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dan</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Gacha</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Manba</label>
          <select
            value={sourceModule}
            onChange={(e) => setSourceModule(e.target.value as '' | JournalEntrySourceModule)}
            className="input"
          >
            <option value="">Barchasi</option>
            {(Object.keys(SOURCE_MODULE_LABELS) as JournalEntrySourceModule[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_MODULE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={load} className="btn-secondary">
          Filtrlash
        </button>
        {canCreate && (
          <button type="button" onClick={() => setShowNewEntry(true)} className="btn-primary ml-auto">
            Yangi yozuv
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {entries.length === 0 && <p className="p-4 text-sm text-slate-500">Jurnal yozuvlari topilmadi</p>}
          {entries.map((entry) => {
            const total = (entry.lines ?? []).reduce((sum, l) => sum + Number(l.debit), 0);
            return (
              <div key={entry.id} className="p-3 text-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-medium text-slate-900">{entry.description}</p>
                  <span className="text-xs text-slate-400">
                    {entry.entryDate} · {SOURCE_MODULE_LABELS[entry.sourceModule] ?? entry.sourceModule}
                  </span>
                </div>
                <ul className="text-xs text-slate-600 space-y-0.5">
                  {(entry.lines ?? []).map((line) => (
                    <li key={line.id} className="flex items-center justify-between">
                      <span>
                        {line.account?.code ? `${line.account.code} · ${line.account.name}` : line.accountId}
                        {line.description && <span className="text-slate-400"> ({line.description})</span>}
                      </span>
                      <span>
                        {Number(line.debit) > 0 ? `Debet ${line.debit}` : `Kredit ${line.credit}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-right text-xs text-slate-400 mt-1">Jami: {total.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      )}

      {showNewEntry && (
        <NewJournalEntryModal
          propertyId={propertyId}
          onClose={() => setShowNewEntry(false)}
          onCreated={() => {
            setShowNewEntry(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface EntryLineForm {
  accountId: string;
  side: 'debit' | 'credit';
  amount: string;
  description: string;
}

function NewJournalEntryModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [entryDate, setEntryDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<EntryLineForm[]>([
    { accountId: '', side: 'debit', amount: '', description: '' },
    { accountId: '', side: 'credit', amount: '', description: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AccountDto[]>(`/properties/${propertyId}/accounting/accounts`)
      .then(setAccounts)
      .catch(() => {});
  }, [propertyId]);

  const updateLine = (idx: number, patch: Partial<EntryLineForm>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { accountId: '', side: 'debit', amount: '', description: '' }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const debitTotal = lines.filter((l) => l.side === 'debit').reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const creditTotal = lines.filter((l) => l.side === 'credit').reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const balanced = lines.length >= 2 && debitTotal > 0 && Math.abs(debitTotal - creditTotal) < 0.005;

  const submit = async () => {
    if (!description || !balanced || lines.some((l) => !l.accountId || Number(l.amount) <= 0)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/accounting/journal-entries`, {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          description,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.side === 'debit' ? Number(l.amount) : undefined,
            credit: l.side === 'credit' ? Number(l.amount) : undefined,
            description: l.description || undefined,
          })),
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Yangi jurnal yozuvi" onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-[160px_1fr] gap-2">
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="input" />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tavsif (masalan: oylik ijara to'lovi)"
            className="input"
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_90px_100px_1fr_28px] gap-2 items-center">
              <select value={line.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })} className="input">
                <option value="">Hisob tanlang</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <select
                value={line.side}
                onChange={(e) => updateLine(idx, { side: e.target.value as 'debit' | 'credit' })}
                className="input"
              >
                <option value="debit">Debet</option>
                <option value="credit">Kredit</option>
              </select>
              <input
                value={line.amount}
                onChange={(e) => updateLine(idx, { amount: e.target.value })}
                placeholder="summa"
                className="input"
              />
              <input
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                placeholder="izoh (ixtiyoriy)"
                className="input"
              />
              <button
                type="button"
                onClick={() => removeLine(idx)}
                disabled={lines.length <= 2}
                className="text-slate-400 hover:text-rose-600 disabled:opacity-30 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addLine} className="text-xs text-slate-600 hover:text-slate-900 underline">
          + Qator qo'shish
        </button>

        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
          <span className={balanced ? 'text-emerald-600' : 'text-rose-600'}>
            Debet: {debitTotal.toFixed(2)} · Kredit: {creditTotal.toFixed(2)}
            {!balanced && ' (teng emas)'}
          </span>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button type="button" disabled={busy || !balanced || !description} onClick={submit} className="btn-primary w-full">
          Saqlash
        </button>
      </div>
    </Modal>
  );
}

function TrialBalanceView({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('asOfDate', asOfDate);
      const list = await apiFetch<TrialBalanceRow[]>(
        `/properties/${propertyId}/accounting/trial-balance?${params.toString()}`,
      );
      setRows(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit), 0);
  const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit), 0);

  return (
    <div>
      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sana holatiga</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="input" />
        </div>
        <button type="button" onClick={load} className="btn-secondary">
          Yuklash
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="text-left px-3 py-2">Hisob</th>
                <th className="text-right px-3 py-2">Debet</th>
                <th className="text-right px-3 py-2">Kredit</th>
                <th className="text-right px-3 py-2">Qoldiq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Ma'lumot topilmadi
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.accountId}>
                  <td className="px-3 py-2">
                    {r.code} · {r.name}
                  </td>
                  <td className="px-3 py-2 text-right">{Number(r.debit) > 0 ? r.debit : '—'}</td>
                  <td className="px-3 py-2 text-right">{Number(r.credit) > 0 ? r.credit : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.balance}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-medium">
                  <td className="px-3 py-2">Jami</td>
                  <td className="px-3 py-2 text-right">{totalDebit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{totalCredit.toFixed(2)}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      Math.abs(totalDebit - totalCredit) < 0.005 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {Math.abs(totalDebit - totalCredit) < 0.005 ? 'Muvozanatlashgan' : 'Muvozanatsiz'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function IncomeStatementView({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<IncomeStatementDto | null>(null);
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const result = await apiFetch<IncomeStatementDto>(
        `/properties/${propertyId}/accounting/income-statement?${params.toString()}`,
      );
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const revenueTotal = (data?.revenue ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const expenseTotal = (data?.expense ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div>
      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dan</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Gacha</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
        <button type="button" onClick={load} className="btn-secondary">
          Yuklash
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">Daromadlar</p>
            {(data?.revenue ?? []).length === 0 && <p className="p-4 text-sm text-slate-500">Ma'lumot yo'q</p>}
            {(data?.revenue ?? []).map((r) => (
              <div key={r.accountId} className="px-4 py-2 flex items-center justify-between text-sm">
                <span>
                  {r.code} · {r.name}
                  {r.department && <span className="text-xs text-slate-400"> ({DEPARTMENT_LABELS[r.department] ?? r.department})</span>}
                </span>
                <span className="font-medium text-slate-900">{r.amount}</span>
              </div>
            ))}
            <div className="px-4 py-2 flex items-center justify-between text-sm font-semibold bg-slate-50">
              <span>Jami daromad</span>
              <span>{revenueTotal.toFixed(2)}</span>
            </div>
          </section>

          <section className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">Xarajatlar</p>
            {(data?.expense ?? []).length === 0 && <p className="p-4 text-sm text-slate-500">Ma'lumot yo'q</p>}
            {(data?.expense ?? []).map((r) => (
              <div key={r.accountId} className="px-4 py-2 flex items-center justify-between text-sm">
                <span>
                  {r.code} · {r.name}
                  {r.department && <span className="text-xs text-slate-400"> ({DEPARTMENT_LABELS[r.department] ?? r.department})</span>}
                </span>
                <span className="font-medium text-slate-900">{r.amount}</span>
              </div>
            ))}
            <div className="px-4 py-2 flex items-center justify-between text-sm font-semibold bg-slate-50">
              <span>Jami xarajat</span>
              <span>{expenseTotal.toFixed(2)}</span>
            </div>
          </section>

          <div className="bg-brand-navy text-white rounded-lg px-4 py-3 flex items-center justify-between text-sm font-semibold">
            <span>Sof foyda</span>
            <span>{(revenueTotal - expenseTotal).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
