import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { NightAuditRunDto, NightAuditStatusDto, PaginatedResult } from '../lib/types';

const HISTORY_PAGE_SIZE = 30;

function money(n: string, currency: string): string {
  return `${Number(n).toLocaleString('uz-UZ')} ${currency}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uz-UZ');
}

// Night Audit — mehmonxonaning kunlik "kunni yopish" jarayoni: kelmagan
// (no-show) mehmonlarni avtomatik belgilaydi, shu kecha uchun bandlik/ADR/
// RevPAR ko'rsatkichlarini o'zgarmas audit yozuvi sifatida saqlaydi, va
// mulkning "biznes sanasi"ni bir kunga suradi. Bir kunni faqat bir marta
// yopish mumkin (backend UNIQUE constraint + aniq tekshiruv bilan himoyalangan).
export function NightAuditPage() {
  const { property, can } = useAuth();
  const canView = can('front_desk', 'view');
  const canRun = can('front_desk', 'approve');

  const [status, setStatus] = useState<NightAuditStatusDto | null>(null);
  const [history, setHistory] = useState<NightAuditRunDto[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!property || !canView) return;
    setError(null);
    Promise.all([
      apiFetch<NightAuditStatusDto>(
        `/properties/${property.id}/night-audit/status`,
      ),
      apiFetch<PaginatedResult<NightAuditRunDto>>(
        `/properties/${property.id}/night-audit/history?page=${historyPage}&pageSize=${HISTORY_PAGE_SIZE}`,
      ),
    ])
      .then(([s, h]) => {
        setStatus(s);
        setHistory(h.items);
        setHistoryTotal(h.total);
      })
      .catch(() => setError('Ma\'lumotlarni yuklashda xatolik yuz berdi'));
  }, [property, canView, historyPage]);

  useEffect(() => {
    load();
  }, [load]);

  const runAudit = async () => {
    if (!property) return;
    setRunning(true);
    setRunError(null);
    try {
      await apiFetch(`/properties/${property.id}/night-audit/run`, {
        method: 'POST',
      });
      setConfirmOpen(false);
      load();
    } catch (e) {
      setRunError(
        e instanceof ApiError ? e.message : "Night Audit'ni ishga tushirishda xatolik",
      );
    } finally {
      setRunning(false);
    }
  };

  const currency = property?.currency ?? 'UZS';

  return (
    <AppLayout title="Kunni yopish (Night Audit)">
      {!canView && (
        <p className="text-sm text-slate-500">Bu bo'limni ko'rish uchun ruxsatingiz yo'q.</p>
      )}

      {canView && (
        <div className="space-y-6">
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-slate-500">Joriy biznes sanasi</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {status?.businessDate ?? '—'}
                </p>
                {status && status.pendingNoShows > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {status.pendingNoShows} ta bron kelish sanasi o'tgan, hali check-in qilinmagan —
                    Night Audit ularni avtomatik "kelmadi" (no-show) deb belgilaydi.
                  </p>
                )}
                {status?.lastAuditDate && (
                  <p className="text-xs text-slate-400 mt-1">
                    Oxirgi yopilgan kun: {status.lastAuditDate} ({formatDateTime(status.lastRunAt)})
                  </p>
                )}
              </div>
              {canRun && (
                <button className="btn-primary" onClick={() => setConfirmOpen(true)}>
                  Kunni yopish
                </button>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Tarix</h2>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Sana</th>
                    <th className="px-4 py-2 font-medium">Bandlik</th>
                    <th className="px-4 py-2 font-medium">ADR</th>
                    <th className="px-4 py-2 font-medium">RevPAR</th>
                    <th className="px-4 py-2 font-medium">Xona daromadi</th>
                    <th className="px-4 py-2 font-medium">No-show</th>
                    <th className="px-4 py-2 font-medium">Bajarildi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        Hali Night Audit bajarilmagan
                      </td>
                    </tr>
                  )}
                  {history.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{run.auditDate}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {run.occupancyRatePct}% ({run.occupiedRooms}/{run.totalRooms})
                      </td>
                      <td className="px-4 py-2 text-slate-700">{money(run.adr, currency)}</td>
                      <td className="px-4 py-2 text-slate-700">{money(run.revPar, currency)}</td>
                      <td className="px-4 py-2 text-slate-700">{money(run.roomRevenue, currency)}</td>
                      <td className="px-4 py-2 text-slate-700">{run.noShowsProcessed}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{formatDateTime(run.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={historyPage} pageSize={HISTORY_PAGE_SIZE} total={historyTotal} onPageChange={setHistoryPage} />
          </section>
        </div>
      )}

      {confirmOpen && (
        <Modal title="Kunni yopish" onClose={() => (running ? null : setConfirmOpen(false))}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {status?.businessDate} sanasini yopmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi:
              kelish sanasi o'tgan, hali check-in qilinmagan bronlar "kelmadi" (no-show) deb
              belgilanadi, shu kecha uchun bandlik/ADR/RevPAR audit yozuvi sifatida saqlanadi, va
              biznes sanasi ertasi kunga suriladi.
            </p>
            {runError && <p className="text-sm text-rose-600">{runError}</p>}
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                disabled={running}
                onClick={() => setConfirmOpen(false)}
              >
                Bekor qilish
              </button>
              <button className="btn-primary" disabled={running} onClick={runAudit}>
                {running ? 'Bajarilmoqda...' : 'Ha, kunni yopish'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
