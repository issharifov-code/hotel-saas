import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  InvoiceDto,
  InvoicePaymentMethod,
  InvoiceStatus,
  PaginatedResult,
  PaymentProviderDto,
} from '../lib/types';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: 'Ochiq',
  issued: 'Yakunlangan',
  paid: "To'langan",
  cancelled: 'Bekor qilingan',
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-500',
};

const SOURCE_LABELS: Record<string, string> = {
  room_charge: 'Xona narxi',
  pos_order: 'POS buyurtma',
  manual: "Qo'lda qo'shilgan",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Naqd',
  card: 'Karta',
  bank_transfer: "Bank o'tkazmasi",
  online: 'Onlayn (shlyuz)',
};

// To'lov shlyuzi provider kodi -> foydalanuvchiga ko'rinadigan nom. Ro'yxatdan
// o'tmagan (kelajakda qo'shiladigan) provayderlar uchun kod o'zi ko'rsatiladi.
const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock to'lov shlyuzi (demo)",
};

export function InvoicingPage() {
  const { property, can } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<PaginatedResult<InvoiceDto>>(
        `/properties/${property.id}/invoices?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setInvoices(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, page]);

  const canCreate = can('invoicing', 'create');
  const canEdit = can('invoicing', 'edit');

  return (
    <AppLayout title="Hisob-fakturalar">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {invoices.length === 0 && <p className="p-4 text-sm text-slate-500">Hali hisob-faktura yo'q</p>}
          {invoices.map((inv) => {
            const balance = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
            return (
              <button
                key={inv.id}
                onClick={() => setDetailId(inv.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-900">
                      {inv.guest?.fullName ?? inv.guestId} · № {inv.booking?.room?.roomNumber ?? '—'}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {inv.booking?.checkIn} — {inv.booking?.checkOut}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {inv.totalAmount} {inv.currency}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Number(balance) > 0 ? `Qoldiq: ${balance}` : "To'liq to'langan"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}

      {detailId && property && (
        <InvoiceDetailModal
          propertyId={property.id}
          invoiceId={detailId}
          canCreate={canCreate}
          canEdit={canEdit}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </AppLayout>
  );
}

function InvoiceDetailModal({
  propertyId,
  invoiceId,
  canCreate,
  canEdit,
  onClose,
  onChanged,
}: {
  propertyId: string;
  invoiceId: string;
  canCreate: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>('cash');
  const [providers, setProviders] = useState<PaymentProviderDto[]>([]);
  const [chargingProvider, setChargingProvider] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const inv = await apiFetch<InvoiceDto>(`/properties/${propertyId}/invoices/${invoiceId}`);
      setInvoice(inv);
      const balance = Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount));
      setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    }
  };

  useEffect(() => {
    load();
    apiFetch<PaymentProviderDto[]>(`/properties/${propertyId}/payment-providers`)
      .then(setProviders)
      .catch(() => setProviders([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const addLine = async () => {
    if (!lineDesc || Number(lineQty) <= 0 || Number(linePrice) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/invoices/${invoiceId}/lines`, {
        method: 'POST',
        body: JSON.stringify({ description: lineDesc, quantity: Number(lineQty), unitPrice: Number(linePrice) }),
      });
      setLineDesc('');
      setLineQty('1');
      setLinePrice('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const addPayment = async () => {
    if (Number(paymentAmount) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paymentAmount), method: paymentMethod }),
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  // Payments moduli — to'lov shlyuzi adapteri orqali (hozircha faqat mock)
  // to'lovni "haqiqiy" ravishda amalga oshiradi, so'ng InvoicingService'ga
  // avtomatik yozadi. Qo'lda kiritishdan farqi: bu yerda backend adapterga
  // murojaat qilib, natija muvaffaqiyatli bo'lgandagina yozuv qo'shiladi.
  const chargeViaGateway = async (provider: string) => {
    if (Number(paymentAmount) <= 0) return;
    setChargingProvider(provider);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/invoices/${invoiceId}/charge`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paymentAmount), provider }),
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "To'lov amalga oshmadi");
    } finally {
      setChargingProvider(null);
    }
  };

  const cancelInvoice = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/invoices/${invoiceId}/cancel`, { method: 'POST' });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  if (!invoice) {
    return (
      <Modal title="Hisob-faktura" onClose={onClose}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
      </Modal>
    );
  }

  const balance = (Number(invoice.totalAmount) - Number(invoice.paidAmount)).toFixed(2);
  const chargeable = invoice.status === 'open' || invoice.status === 'issued';

  return (
    <Modal
      title={`${invoice.guest?.fullName ?? invoice.guestId} · № ${invoice.booking?.room?.roomNumber ?? '—'}`}
      onClose={onClose}
      width="max-w-xl"
    >
      <div className="space-y-4">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[invoice.status]}`}>
          {STATUS_LABELS[invoice.status]}
        </span>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Qatorlar</p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
            {(invoice.lines ?? []).map((line) => (
              <li key={line.id} className="px-3 py-2 flex items-center justify-between text-sm">
                <span>
                  {line.description}
                  <span className="text-xs text-slate-400"> · {SOURCE_LABELS[line.source] ?? line.source}</span>
                </span>
                <span className="text-slate-600">{line.amount}</span>
              </li>
            ))}
          </ul>
        </div>

        {chargeable && canCreate && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">Qo'shimcha xarajat qo'shish</p>
            <div className="grid grid-cols-[1fr_70px_90px] gap-2">
              <input
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                placeholder="Tavsif (masalan: minibar)"
                className="input"
              />
              <input value={lineQty} onChange={(e) => setLineQty(e.target.value)} placeholder="soni" className="input" />
              <input
                value={linePrice}
                onChange={(e) => setLinePrice(e.target.value)}
                placeholder="narx"
                className="input"
              />
            </div>
            <button type="button" disabled={busy} onClick={addLine} className="btn-secondary">
              Qo'shish
            </button>
          </div>
        )}

        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">Jami</span>
          <span className="font-medium text-slate-900">
            {invoice.totalAmount} {invoice.currency}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">To'langan</span>
          <span className="text-slate-900">
            {invoice.paidAmount} {invoice.currency}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Qoldiq</span>
          <span className={Number(balance) > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600 font-medium'}>
            {balance} {invoice.currency}
          </span>
        </div>

        {(invoice.payments ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">To'lovlar</p>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {(invoice.payments ?? []).map((p) => (
                <li key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span>
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    {p.provider && (
                      <span className="text-xs text-slate-400">
                        {' '}
                        · {PROVIDER_LABELS[p.provider] ?? p.provider}
                        {p.providerRef ? ` (${p.providerRef})` : ''}
                      </span>
                    )}{' '}
                    · {new Date(p.createdAt).toLocaleString('uz-UZ')}
                  </span>
                  <span className="text-slate-600">{p.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {Number(balance) > 0 && invoice.status !== 'cancelled' && canCreate && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <input
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="input w-full"
              placeholder="Summa"
            />
            <div className="flex items-center gap-2">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as InvoicePaymentMethod)}
                className="input flex-1"
              >
                <option value="cash">Naqd</option>
                <option value="card">Karta</option>
                <option value="bank_transfer">Bank o'tkazmasi</option>
              </select>
              <button type="button" disabled={busy} onClick={addPayment} className="btn-primary shrink-0">
                Qo'lda qayd etish
              </button>
            </div>
            {providers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">yoki to'lov shlyuzi orqali:</span>
                {providers.map((p) => (
                  <button
                    key={p.provider}
                    type="button"
                    disabled={chargingProvider !== null}
                    onClick={() => chargeViaGateway(p.provider)}
                    className="btn-secondary shrink-0"
                  >
                    {chargingProvider === p.provider
                      ? 'Yuborilmoqda...'
                      : PROVIDER_LABELS[p.provider] ?? p.provider}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && canEdit && (
          <button
            type="button"
            disabled={busy}
            onClick={cancelInvoice}
            className="text-xs text-slate-500 hover:text-rose-600 underline"
          >
            Hisob-fakturani bekor qilish
          </button>
        )}
      </div>
    </Modal>
  );
}
