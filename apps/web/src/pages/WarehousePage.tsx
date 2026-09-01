import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  PurchaseOrderDto,
  PurchaseOrderStatus,
  StockItemDto,
  StockLevelDto,
  SupplierDto,
  WarehouseDto,
} from '../lib/types';

type Tab = 'stock' | 'items' | 'suppliers' | 'orders';

const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Qoralama',
  pending_approval: 'Tasdiqlanishi kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  partially_received: 'Qisman qabul qilingan',
  received: 'Qabul qilingan',
  cancelled: 'Bekor qilingan',
};

const PO_STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-rose-100 text-rose-800',
  partially_received: 'bg-indigo-100 text-indigo-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-500',
};

const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ['draft', 'pending_approval', 'approved', 'partially_received'];

export function WarehousePage() {
  const { property, can } = useAuth();
  const [tab, setTab] = useState<Tab>('stock');
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [stockLevels, setStockLevels] = useState<StockLevelDto[]>([]);
  const [stockItems, setStockItems] = useState<StockItemDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrderDto | null>(null);
  const [actionItem, setActionItem] = useState<StockLevelDto | null>(null);

  const loadStockLevels = async (whId: string) => {
    if (!property) return;
    const levels = await apiFetch<StockLevelDto[]>(`/properties/${property.id}/warehouses/${whId}/stock-levels`);
    setStockLevels(levels);
  };

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const whs = await apiFetch<WarehouseDto[]>(`/properties/${property.id}/warehouses`);
      setWarehouses(whs);
      const whId = warehouseId && whs.some((w) => w.id === warehouseId) ? warehouseId : (whs[0]?.id ?? null);
      setWarehouseId(whId);
      const [items, sups, ords] = await Promise.all([
        apiFetch<StockItemDto[]>('/stock-items'),
        apiFetch<SupplierDto[]>('/suppliers'),
        apiFetch<PurchaseOrderDto[]>(`/properties/${property.id}/purchase-orders`),
      ]);
      setStockItems(items);
      setSuppliers(sups);
      setOrders(ords);
      if (whId) {
        await loadStockLevels(whId);
      }
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

  const selectWarehouse = async (whId: string) => {
    setWarehouseId(whId);
    setError(null);
    try {
      await loadStockLevels(whId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    }
  };

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stock', label: 'Zaxira' },
    { key: 'items', label: 'Tovarlar' },
    { key: 'suppliers', label: "Ta'minotchilar" },
    { key: 'orders', label: 'Xarid buyurtmalari' },
  ];

  return (
    <AppLayout title="Ombor">
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
      ) : (
        <>
          {tab === 'stock' && (
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <select
                  value={warehouseId ?? ''}
                  onChange={(e) => selectWarehouse(e.target.value)}
                  className="input max-w-xs"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.isDefault ? ' (asosiy)' : ''}
                    </option>
                  ))}
                </select>
                {can('warehouse', 'create') && (
                  <button onClick={() => setShowCreateWarehouse(true)} className="btn-secondary shrink-0">
                    + Ombor qo'shish
                  </button>
                )}
              </div>
              <StockLevelsSection
                levels={stockLevels}
                canEdit={can('warehouse', 'edit') || can('warehouse', 'create')}
                onAction={(row) => setActionItem(row)}
              />
            </div>
          )}
          {tab === 'items' && (
            <StockItemsSection
              items={stockItems}
              canCreate={can('warehouse', 'create')}
              onCreate={() => setShowCreateItem(true)}
            />
          )}
          {tab === 'suppliers' && (
            <SuppliersSection
              suppliers={suppliers}
              canCreate={can('warehouse', 'create')}
              onCreate={() => setShowCreateSupplier(true)}
            />
          )}
          {tab === 'orders' && (
            <PurchaseOrdersSection
              orders={orders}
              supplierMap={supplierMap}
              canCreate={can('warehouse', 'create')}
              canApprove={can('warehouse', 'approve')}
              canEdit={can('warehouse', 'edit')}
              propertyId={property!.id}
              onCreate={() => setShowCreateOrder(true)}
              onReceive={(po) => setReceiveOrder(po)}
              onChanged={load}
              setError={setError}
            />
          )}
        </>
      )}

      {showCreateItem && (
        <CreateStockItemModal
          onClose={() => setShowCreateItem(false)}
          onCreated={() => {
            setShowCreateItem(false);
            load();
          }}
        />
      )}

      {showCreateWarehouse && property && (
        <CreateWarehouseModal
          propertyId={property.id}
          onClose={() => setShowCreateWarehouse(false)}
          onCreated={() => {
            setShowCreateWarehouse(false);
            load();
          }}
        />
      )}

      {showCreateSupplier && (
        <CreateSupplierModal
          onClose={() => setShowCreateSupplier(false)}
          onCreated={() => {
            setShowCreateSupplier(false);
            load();
          }}
        />
      )}

      {showCreateOrder && property && (
        <CreatePurchaseOrderModal
          propertyId={property.id}
          stockItems={stockItems}
          suppliers={suppliers}
          onClose={() => setShowCreateOrder(false)}
          onCreated={() => {
            setShowCreateOrder(false);
            load();
          }}
        />
      )}

      {receiveOrder && property && (
        <ReceivePurchaseOrderModal
          propertyId={property.id}
          order={receiveOrder}
          onClose={() => setReceiveOrder(null)}
          onReceived={() => {
            setReceiveOrder(null);
            load();
          }}
        />
      )}

      {actionItem && property && warehouseId && (
        <StockActionModal
          propertyId={property.id}
          warehouseId={warehouseId}
          item={actionItem}
          onClose={() => setActionItem(null)}
          onDone={() => {
            setActionItem(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateWarehouseModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/warehouses`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi ombor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="masalan: Oshxona ombori"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

// ---------- Zaxira (Stock levels) ----------

function StockLevelsSection({
  levels,
  canEdit,
  onAction,
}: {
  levels: StockLevelDto[];
  canEdit: boolean;
  onAction: (row: StockLevelDto) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      {levels.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          Hali tovar yo'q — avval "Tovarlar" bo'limidan tovar qo'shing.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2">SKU</th>
              <th className="text-left px-4 py-2">Nomi</th>
              <th className="text-right px-4 py-2">Qoldiq</th>
              <th className="text-right px-4 py-2">Reorder point</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {levels.map((row) => (
              <tr key={row.stockItemId} className={row.belowReorderPoint ? 'bg-rose-50' : ''}>
                <td className="px-4 py-2.5 text-slate-500">{row.sku}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.quantityOnHand} {row.unit}
                  {row.belowReorderPoint && (
                    <span className="ml-2 text-xs font-medium text-rose-600">kam qoldi</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-500">
                  {row.reorderPoint} {row.unit}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {canEdit && (
                    <button onClick={() => onAction(row)} className="text-xs text-slate-600 hover:text-slate-900 underline">
                      Chiqim / Tuzatish
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StockActionModal({
  propertyId,
  warehouseId,
  item,
  onClose,
  onDone,
}: {
  propertyId: string;
  warehouseId: string;
  item: StockLevelDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'issue' | 'adjust'>('issue');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'issue') {
        await apiFetch(`/properties/${propertyId}/warehouses/${warehouseId}/issue`, {
          method: 'POST',
          body: JSON.stringify({ stockItemId: item.stockItemId, quantity, notes: reason || undefined }),
        });
      } else {
        await apiFetch(`/properties/${propertyId}/warehouses/${warehouseId}/adjust`, {
          method: 'POST',
          body: JSON.stringify({ stockItemId: item.stockItemId, quantity, reason }),
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`${item.name} — harakat`} onClose={onClose}>
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['issue', 'adjust'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${
              mode === m ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
            }`}
          >
            {m === 'issue' ? 'Chiqim' : 'Inventarizatsiya tuzatishi'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-500">
          Joriy qoldiq: {item.quantityOnHand} {item.unit}
        </p>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {mode === 'issue' ? 'Chiqim miqdori' : "Tuzatish miqdori (musbat yoki manfiy, masalan -2.5)"}
          </span>
          <input
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input"
            placeholder={mode === 'issue' ? 'masalan 3' : 'masalan -1.5'}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {mode === 'issue' ? 'Izoh (ixtiyoriy)' : 'Sabab'}
          </span>
          <input
            required={mode === 'adjust'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Tasdiqlash'}
        </button>
      </form>
    </Modal>
  );
}

// ---------- Tovarlar (Stock items) ----------

function StockItemsSection({
  items,
  canCreate,
  onCreate,
}: {
  items: StockItemDto[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        {canCreate && (
          <button onClick={onCreate} className="btn-primary">
            + Tovar qo'shish
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {items.length === 0 && <p className="p-4 text-sm text-slate-500">Hali tovar qo'shilmagan</p>}
        {items.map((it) => (
          <div key={it.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{it.name}</p>
              <p className="text-xs text-slate-500">
                SKU: {it.sku} · {it.unit}
                {it.category ? ` · ${it.category}` : ''}
                {!it.isActive ? ' · nofaol' : ''}
              </p>
            </div>
            <p className="text-xs text-slate-500">Reorder: {it.reorderPoint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateStockItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/stock-items', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          name,
          unit,
          category: category || undefined,
          reorderPoint: reorderPoint || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi tovar" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">SKU</span>
          <input required value={sku} onChange={(e) => setSku(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">O'lchov birligi</span>
            <input required value={unit} onChange={(e) => setUnit(e.target.value)} className="input" placeholder="kg, dona..." />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Reorder point</span>
            <input value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="input" placeholder="0" />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Toifa (ixtiyoriy)</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

// ---------- Ta'minotchilar (Suppliers) ----------

function SuppliersSection({
  suppliers,
  canCreate,
  onCreate,
}: {
  suppliers: SupplierDto[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        {canCreate && (
          <button onClick={onCreate} className="btn-primary">
            + Ta'minotchi qo'shish
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {suppliers.length === 0 && <p className="p-4 text-sm text-slate-500">Hali ta'minotchi qo'shilmagan</p>}
        {suppliers.map((s) => (
          <div key={s.id} className="p-4">
            <p className="font-medium text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">
              {[s.contactPerson, s.phone, s.email].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          contactPerson: contactPerson || undefined,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi ta'minotchi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Aloqador shaxs</span>
          <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+998..." />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Manzil</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

// ---------- Xarid buyurtmalari (Purchase orders) ----------

function PurchaseOrdersSection({
  orders,
  supplierMap,
  canCreate,
  canApprove,
  canEdit,
  propertyId,
  onCreate,
  onReceive,
  onChanged,
  setError,
}: {
  orders: PurchaseOrderDto[];
  supplierMap: Map<string, SupplierDto>;
  canCreate: boolean;
  canApprove: boolean;
  canEdit: boolean;
  propertyId: string;
  onCreate: () => void;
  onReceive: (po: PurchaseOrderDto) => void;
  onChanged: () => void;
  setError: (e: string | null) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/purchase-orders/${id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        {canCreate && (
          <button onClick={onCreate} className="btn-primary">
            + Xarid buyurtmasi
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {orders.length === 0 && <p className="p-4 text-sm text-slate-500">Hali xarid buyurtmasi yo'q</p>}
        {orders.map((po) => (
          <div key={po.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {supplierMap.get(po.supplierId)?.name ?? "Noma'lum ta'minotchi"}
                </p>
                <p className="text-xs text-slate-500">
                  {po.items.length} band · {po.totalAmount} {po.currency} ·{' '}
                  {new Date(po.createdAt).toLocaleDateString('uz-UZ')}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${PO_STATUS_STYLES[po.status]}`}>
                {PO_STATUS_LABELS[po.status]}
              </span>
            </div>

            <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
              {po.items.map((item) => (
                <li key={item.id}>
                  {item.stockItem?.name ?? item.stockItemId}: {item.quantityReceived}/{item.quantityOrdered}{' '}
                  {item.stockItem?.unit ?? ''} @ {item.unitCost}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex gap-2">
              {po.status === 'pending_approval' && canApprove && (
                <>
                  <button
                    disabled={busyId === po.id}
                    onClick={() => runAction(po.id, 'approve')}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Tasdiqlash
                  </button>
                  <button
                    disabled={busyId === po.id}
                    onClick={() => runAction(po.id, 'reject')}
                    className="text-xs font-medium text-rose-700 hover:text-rose-900 underline"
                  >
                    Rad etish
                  </button>
                </>
              )}
              {(po.status === 'approved' || po.status === 'partially_received') && canEdit && (
                <button onClick={() => onReceive(po)} className="text-xs font-medium text-slate-700 hover:text-slate-900 underline">
                  Qabul qilish
                </button>
              )}
              {OPEN_PO_STATUSES.includes(po.status) && canEdit && (
                <button
                  disabled={busyId === po.id}
                  onClick={() => runAction(po.id, 'cancel')}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                >
                  Bekor qilish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreatePurchaseOrderModal({
  propertyId,
  stockItems,
  suppliers,
  onClose,
  onCreated,
}: {
  propertyId: string;
  stockItems: StockItemDto[];
  suppliers: SupplierDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [lines, setLines] = useState<{ stockItemId: string; quantityOrdered: string; unitCost: string }[]>([
    { stockItemId: stockItems[0]?.id ?? '', quantityOrdered: '', unitCost: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateLine = (idx: number, patch: Partial<(typeof lines)[number]>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError("Ta'minotchini tanlang");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/purchase-orders`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          items: lines
            .filter((l) => l.stockItemId && l.quantityOrdered && l.unitCost)
            .map((l) => ({ stockItemId: l.stockItemId, quantityOrdered: l.quantityOrdered, unitCost: l.unitCost })),
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  if (suppliers.length === 0 || stockItems.length === 0) {
    return (
      <Modal title="Yangi xarid buyurtmasi" onClose={onClose}>
        <p className="text-sm text-slate-600">
          Avval kamida bitta ta'minotchi va tovar qo'shing.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title="Yangi xarid buyurtmasi" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Ta'minotchi</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input" required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-600">Bandlar</span>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <select
                value={line.stockItemId}
                onChange={(e) => updateLine(idx, { stockItemId: e.target.value })}
                className="input"
              >
                {stockItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <input
                value={line.quantityOrdered}
                onChange={(e) => updateLine(idx, { quantityOrdered: e.target.value })}
                placeholder="miqdor"
                className="input w-24"
              />
              <input
                value={line.unitCost}
                onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                placeholder="narx"
                className="input w-24"
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
            onClick={() => setLines((prev) => [...prev, { stockItemId: stockItems[0]?.id ?? '', quantityOrdered: '', unitCost: '' }])}
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            + Band qo'shish
          </button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Buyurtma yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function ReceivePurchaseOrderModal({
  propertyId,
  order,
  onClose,
  onReceived,
}: {
  propertyId: string;
  order: PurchaseOrderDto;
  onClose: () => void;
  onReceived: () => void;
}) {
  const remaining = (item: PurchaseOrderDto['items'][number]) =>
    (Number(item.quantityOrdered) - Number(item.quantityReceived)).toFixed(3);

  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((item) => [item.id, remaining(item)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const lines = Object.entries(quantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([purchaseOrderItemId, quantityReceived]) => ({ purchaseOrderItemId, quantityReceived }));
      if (lines.length === 0) {
        setError('Kamida bitta band uchun miqdor kiriting');
        setSubmitting(false);
        return;
      }
      await apiFetch(`/properties/${propertyId}/purchase-orders/${order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ lines }),
      });
      onReceived();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Tovarni qabul qilish" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-slate-900">{item.stockItem?.name ?? item.stockItemId}</p>
              <p className="text-xs text-slate-500">
                Buyurtma: {item.quantityOrdered} · Qabul qilingan: {item.quantityReceived} · Qoldi: {remaining(item)}
              </p>
            </div>
            <input
              value={quantities[item.id] ?? ''}
              onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
              className="input w-24"
            />
          </div>
        ))}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Qabul qilish'}
        </button>
      </form>
    </Modal>
  );
}
