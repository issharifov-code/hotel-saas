import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingDto, MenuItemDto, PosOrderDto, PosOrderStatus, PosPaymentMethod } from '../lib/types';

type Tab = 'orders' | 'menu';

const ORDER_STATUS_LABELS: Record<PosOrderStatus, string> = {
  open: 'Ochiq',
  paid: "To'langan",
  cancelled: 'Bekor qilingan',
};

const ORDER_STATUS_STYLES: Record<PosOrderStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-500',
};

export function PosPage() {
  const { property, can } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<PosOrderDto[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateMenuItem, setShowCreateMenuItem] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PosOrderDto | null>(null);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const [ords, items] = await Promise.all([
        apiFetch<PosOrderDto[]>(`/properties/${property.id}/pos-orders`),
        apiFetch<MenuItemDto[]>('/menu-items'),
      ]);
      setOrders(ords);
      setMenuItems(items);
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

  // detailOrder ochiq bo'lsa, ro'yxat yangilanganda uni ham eng so'nggi holat bilan sinxronlaymiz
  useEffect(() => {
    if (!detailOrder) return;
    const fresh = orders.find((o) => o.id === detailOrder.id);
    if (fresh) setDetailOrder(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const activeMenuItems = useMemo(() => menuItems.filter((m) => m.isActive), [menuItems]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'Buyurtmalar' },
    { key: 'menu', label: 'Menyu' },
  ];

  return (
    <AppLayout title="POS (Restoran/Bar)">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : tab === 'orders' ? (
        <div>
          <div className="flex justify-end mb-3">
            {can('pos', 'create') && (
              <button onClick={() => setShowCreateOrder(true)} className="btn-primary">
                + Yangi buyurtma
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {orders.length === 0 && <p className="text-sm text-slate-500">Hali buyurtma yo'q</p>}
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setDetailOrder(o)}
                className="text-left bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-slate-900">{o.tableNumber ? `Stol № ${o.tableNumber}` : 'Buyurtma'}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLES[o.status]}`}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {o.items.length} taom · {o.totalAmount} {o.currency}
                </p>
                <p className="text-xs text-slate-400 mt-1">{new Date(o.createdAt).toLocaleString('uz-UZ')}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            {can('pos', 'create') && (
              <button onClick={() => setShowCreateMenuItem(true)} className="btn-primary">
                + Taom qo'shish
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {menuItems.length === 0 && <p className="p-4 text-sm text-slate-500">Hali menyu bo'sh</p>}
            {menuItems.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.category ?? '—'}
                    {!m.isActive ? ' · nofaol' : ''}
                  </p>
                </div>
                <p className="text-sm text-slate-700">{m.price} UZS</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateOrder && property && (
        <CreatePosOrderModal
          propertyId={property.id}
          menuItems={activeMenuItems}
          onClose={() => setShowCreateOrder(false)}
          onCreated={() => {
            setShowCreateOrder(false);
            load();
          }}
        />
      )}

      {showCreateMenuItem && (
        <CreateMenuItemModal
          onClose={() => setShowCreateMenuItem(false)}
          onCreated={() => {
            setShowCreateMenuItem(false);
            load();
          }}
        />
      )}

      {detailOrder && property && (
        <PosOrderDetailModal
          propertyId={property.id}
          order={detailOrder}
          menuItems={activeMenuItems}
          canEdit={can('pos', 'edit')}
          onClose={() => setDetailOrder(null)}
          onChanged={load}
        />
      )}
    </AppLayout>
  );
}

function CreatePosOrderModal({
  propertyId,
  menuItems,
  onClose,
  onCreated,
}: {
  propertyId: string;
  menuItems: MenuItemDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tableNumber, setTableNumber] = useState('');
  const [lines, setLines] = useState<{ menuItemId: string; quantity: string }[]>([
    { menuItemId: menuItems[0]?.id ?? '', quantity: '1' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateLine = (idx: number, patch: Partial<(typeof lines)[number]>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/pos-orders`, {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: tableNumber || undefined,
          items: lines
            .filter((l) => l.menuItemId && Number(l.quantity) > 0)
            .map((l) => ({ menuItemId: l.menuItemId, quantity: Number(l.quantity) })),
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  if (menuItems.length === 0) {
    return (
      <Modal title="Yangi buyurtma" onClose={onClose}>
        <p className="text-sm text-slate-600">Avval "Menyu" bo'limidan taom qo'shing.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Yangi buyurtma" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Stol raqami (ixtiyoriy)</span>
          <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="input" />
        </label>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-600">Taomlar</span>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <select
                value={line.menuItemId}
                onChange={(e) => updateLine(idx, { menuItemId: e.target.value })}
                className="input"
              >
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.price}
                  </option>
                ))}
              </select>
              <input
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                className="input w-20"
                placeholder="soni"
              />
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lines.length === 1}
                className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { menuItemId: menuItems[0]?.id ?? '', quantity: '1' }])}
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            + Taom qo'shish
          </button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Buyurtma ochish'}
        </button>
      </form>
    </Modal>
  );
}

function CreateMenuItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/menu-items', {
        method: 'POST',
        body: JSON.stringify({ name, category: category || undefined, price }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi taom" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Toifa</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="Taomlar, Ichimliklar..." />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Narx (UZS)</span>
            <input required value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

function PosOrderDetailModal({
  propertyId,
  order,
  menuItems,
  canEdit,
  onClose,
  onChanged,
}: {
  propertyId: string;
  order: PosOrderDto;
  menuItems: MenuItemDto[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [addMenuItemId, setAddMenuItemId] = useState(menuItems[0]?.id ?? '');
  const [addQuantity, setAddQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [checkedInBookings, setCheckedInBookings] = useState<BookingDto[]>([]);
  const [roomAccountBookingId, setRoomAccountBookingId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (paymentMethod !== 'room_account' || checkedInBookings.length > 0) return;
    apiFetch<BookingDto[]>(`/properties/${propertyId}/bookings`)
      .then((all) => {
        const active = all.filter((b) => b.status === 'checked_in');
        setCheckedInBookings(active);
        setRoomAccountBookingId(active[0]?.id ?? '');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  const addItem = async () => {
    if (!addMenuItemId || Number(addQuantity) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/pos-orders/${order.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ items: [{ menuItemId: addMenuItemId, quantity: Number(addQuantity) }] }),
      });
      setAddQuantity('1');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (paymentMethod === 'room_account' && !roomAccountBookingId) {
      setError("Xona hisobiga yozish uchun avval mehmon joylashgan bronni tanlang");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/pos-orders/${order.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          bookingId: paymentMethod === 'room_account' ? roomAccountBookingId : undefined,
        }),
      });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/pos-orders/${order.id}/cancel`, { method: 'POST' });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const isOpen = order.status === 'open';

  return (
    <Modal title={order.tableNumber ? `Stol № ${order.tableNumber}` : 'Buyurtma'} onClose={onClose} width="max-w-lg">
      <div className="space-y-3">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLES[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>

        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md">
          {order.items.map((item) => (
            <li key={item.id} className="px-3 py-2 flex items-center justify-between text-sm">
              <span>
                {item.quantity} × {item.menuItem?.name ?? item.menuItemId}
              </span>
              <span className="text-slate-500">{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="text-right text-sm font-medium text-slate-900">
          Jami: {order.totalAmount} {order.currency}
        </p>

        {isOpen && canEdit && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <span className="block text-xs font-medium text-slate-600">Taom qo'shish</span>
            <div className="flex gap-2">
              <select value={addMenuItemId} onChange={(e) => setAddMenuItemId(e.target.value)} className="input flex-1">
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input value={addQuantity} onChange={(e) => setAddQuantity(e.target.value)} className="input w-16" />
              <button type="button" disabled={busy} onClick={addItem} className="btn-secondary shrink-0">
                Qo'shish
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {isOpen && canEdit && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PosPaymentMethod)}
                className="input flex-1"
              >
                <option value="cash">Naqd</option>
                <option value="card">Karta</option>
                <option value="room_account">Xona hisobiga</option>
              </select>
              <button type="button" disabled={busy} onClick={pay} className="btn-primary shrink-0">
                To'lash
              </button>
            </div>
            {paymentMethod === 'room_account' && (
              <select
                value={roomAccountBookingId}
                onChange={(e) => setRoomAccountBookingId(e.target.value)}
                className="input"
              >
                {checkedInBookings.length === 0 && <option value="">Joylashgan mehmon topilmadi</option>}
                {checkedInBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    № {b.room?.roomNumber ?? b.roomId} — {b.guest?.fullName ?? b.guestId}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {isOpen && canEdit && (
          <button type="button" disabled={busy} onClick={cancelOrder} className="text-xs text-slate-500 hover:text-rose-600 underline">
            Buyurtmani bekor qilish
          </button>
        )}
      </div>
    </Modal>
  );
}
