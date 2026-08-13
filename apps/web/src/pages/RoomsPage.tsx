import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { RoomDto, RoomStatus, RoomTypeDto } from '../lib/types';

const STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Bo'sh",
  occupied: 'Band',
  maintenance: 'Texnik xizmat',
  out_of_order: 'Ishlamayapti',
};

const STATUS_STYLES: Record<RoomStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  occupied: 'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_order: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function RoomsPage() {
  const { property, can } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomTypeDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [rt, rm] = await Promise.all([
        apiFetch<RoomTypeDto[]>(`/properties/${property.id}/room-types`),
        apiFetch<RoomDto[]>(`/properties/${property.id}/rooms`),
      ]);
      setRoomTypes(rt);
      setRooms(rm);
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

  const roomTypeById = new Map(roomTypes.map((rt) => [rt.id, rt]));

  return (
    <AppLayout title="Xonalar">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Xona turlari</h2>
          {can('booking', 'create') && (
            <button
              onClick={() => setShowRoomTypeModal(true)}
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700"
            >
              + Xona turi qo'shish
            </button>
          )}
        </div>
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {roomTypes.length === 0 && !loading && (
            <p className="p-4 text-sm text-slate-500">Hali xona turi qo'shilmagan</p>
          )}
          {roomTypes.map((rt) => (
            <div key={rt.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{rt.name}</p>
                <p className="text-xs text-slate-500">
                  {Number(rt.basePrice).toLocaleString('uz-UZ')} so'm / kecha · {rt.maxOccupancy} kishi
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Xonalar ({rooms.length})
          </h2>
          {can('booking', 'create') && (
            <button
              onClick={() => setShowRoomModal(true)}
              disabled={roomTypes.length === 0}
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40"
            >
              + Xona qo'shish
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">№ {room.roomNumber}</p>
                {room.floor != null && <p className="text-xs text-slate-400">{room.floor}-qavat</p>}
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {roomTypeById.get(room.roomTypeId)?.name ?? room.roomType?.name ?? '—'}
              </p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[room.status]}`}>
                {STATUS_LABELS[room.status]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showRoomTypeModal && property && (
        <CreateRoomTypeModal
          propertyId={property.id}
          onClose={() => setShowRoomTypeModal(false)}
          onCreated={() => {
            setShowRoomTypeModal(false);
            load();
          }}
        />
      )}

      {showRoomModal && property && (
        <CreateRoomModal
          propertyId={property.id}
          roomTypes={roomTypes}
          onClose={() => setShowRoomModal(false)}
          onCreated={() => {
            setShowRoomModal(false);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateRoomTypeModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [maxOccupancy, setMaxOccupancy] = useState('2');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/room-types`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          basePrice,
          maxOccupancy: Number(maxOccupancy),
          description: description || undefined,
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
    <Modal title="Yangi xona turi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nomi">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Masalan: Delux"
          />
        </Field>
        <Field label="Bazaviy narx (kechasiga)">
          <input
            required
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className="input"
            placeholder="850000"
          />
        </Field>
        <Field label="Maksimal sig'im (kishi)">
          <input
            required
            type="number"
            min={1}
            value={maxOccupancy}
            onChange={(e) => setMaxOccupancy(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Tavsif (ixtiyoriy)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

function CreateRoomModal({
  propertyId,
  roomTypes,
  onClose,
  onCreated,
}: {
  propertyId: string;
  roomTypes: RoomTypeDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? '');
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId,
          roomNumber,
          floor: floor ? Number(floor) : undefined,
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
    <Modal title="Yangi xona" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Xona turi">
          <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className="input" required>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Xona raqami">
          <input
            required
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="input"
            placeholder="101"
          />
        </Field>
        <Field label="Qavat (ixtiyoriy)">
          <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} className="input" />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
