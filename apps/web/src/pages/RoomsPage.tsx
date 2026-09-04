import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  CancellationFeeType,
  RatePlanDto,
  RatePlanRestrictionDto,
  RoomDto,
  RoomStatus,
  RoomTypeDto,
} from '../lib/types';

const CANCELLATION_FEE_TYPE_LABELS: Record<CancellationFeeType, string> = {
  flat: "Qat'iy summa",
  percent_of_total: "Umumiy summadan foiz",
  first_night: 'Birinchi kecha narxi',
};

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
  const [ratePlans, setRatePlans] = useState<RatePlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showRatePlanModal, setShowRatePlanModal] = useState(false);
  const [restrictionsFor, setRestrictionsFor] = useState<RatePlanDto | null>(null);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [rt, rm, rp] = await Promise.all([
        apiFetch<RoomTypeDto[]>(`/properties/${property.id}/room-types`),
        apiFetch<RoomDto[]>(`/properties/${property.id}/rooms`),
        apiFetch<RatePlanDto[]>(`/properties/${property.id}/rate-plans`),
      ]);
      setRoomTypes(rt);
      setRooms(rm);
      setRatePlans(rp);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const toggleRatePlanActive = async (ratePlan: RatePlanDto) => {
    if (!property) return;
    try {
      await apiFetch(`/properties/${property.id}/rate-plans/${ratePlan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !ratePlan.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Narx rejasini yangilashda xatolik");
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
              className="text-sm bg-brand-navy text-white px-3 py-1.5 rounded-full hover:bg-brand-navy-dark"
            >
              + Xona turi qo'shish
            </button>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
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

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Narx rejalari</h2>
          {can('booking', 'create') && (
            <button
              onClick={() => setShowRatePlanModal(true)}
              disabled={roomTypes.length === 0}
              className="text-sm bg-brand-navy text-white px-3 py-1.5 rounded-full hover:bg-brand-navy-dark disabled:opacity-40"
            >
              + Narx rejasi qo'shish
            </button>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {ratePlans.length === 0 && !loading && (
            <p className="p-4 text-sm text-slate-500">Hali narx rejasi qo'shilmagan — bronlar bazaviy narxdan hisoblanadi</p>
          )}
          {ratePlans.map((rp) => (
            <div key={rp.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {rp.name}
                  {!rp.isActive && <span className="ml-2 text-xs text-slate-400">(nofaol)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {roomTypeById.get(rp.roomTypeId)?.name ?? '—'} · {Number(rp.nightlyPrice).toLocaleString('uz-UZ')} so'm / kecha
                  {!rp.isRefundable && ' · qaytarilmaydi'}
                </p>
                {(rp.cancellationDeadlineDays != null || rp.noShowFeeType) && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {rp.cancellationDeadlineDays != null &&
                      `Bekor qilish: check-in'dan ${rp.cancellationDeadlineDays} kun oldin bepul, keyin jarima`}
                    {rp.cancellationDeadlineDays != null && rp.noShowFeeType && ' · '}
                    {rp.noShowFeeType && 'Kelmaslik (no-show) uchun jarima bor'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {can('booking', 'edit') && (
                  <button
                    onClick={() => setRestrictionsFor(rp)}
                    className="text-xs text-slate-500 hover:text-slate-900 underline"
                  >
                    Cheklovlar
                  </button>
                )}
                {can('booking', 'edit') && (
                  <button
                    onClick={() => toggleRatePlanActive(rp)}
                    className="text-xs text-slate-500 hover:text-slate-900 underline"
                  >
                    {rp.isActive ? 'Nofaollashtirish' : 'Faollashtirish'}
                  </button>
                )}
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
              className="text-sm bg-brand-navy text-white px-3 py-1.5 rounded-full hover:bg-brand-navy-dark disabled:opacity-40"
            >
              + Xona qo'shish
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-4">
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

      {showRatePlanModal && property && (
        <CreateRatePlanModal
          propertyId={property.id}
          roomTypes={roomTypes}
          onClose={() => setShowRatePlanModal(false)}
          onCreated={() => {
            setShowRatePlanModal(false);
            load();
          }}
        />
      )}

      {restrictionsFor && property && (
        <RatePlanRestrictionsModal
          propertyId={property.id}
          ratePlan={restrictionsFor}
          onClose={() => setRestrictionsFor(null)}
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

function CreateRatePlanModal({
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
  const [name, setName] = useState('');
  const [nightlyPrice, setNightlyPrice] = useState('');
  const [isRefundable, setIsRefundable] = useState(true);
  const [description, setDescription] = useState('');
  const [hasCancellationPolicy, setHasCancellationPolicy] = useState(false);
  const [cancellationDeadlineDays, setCancellationDeadlineDays] = useState('3');
  const [cancellationFeeType, setCancellationFeeType] = useState<CancellationFeeType>('first_night');
  const [cancellationFeeValue, setCancellationFeeValue] = useState('');
  const [hasNoShowFee, setHasNoShowFee] = useState(false);
  const [noShowFeeType, setNoShowFeeType] = useState<CancellationFeeType>('first_night');
  const [noShowFeeValue, setNoShowFeeValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/rate-plans`, {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId,
          name,
          nightlyPrice,
          isRefundable,
          description: description || undefined,
          ...(hasCancellationPolicy
            ? {
                cancellationDeadlineDays: Number(cancellationDeadlineDays),
                cancellationFeeType,
                cancellationFeeValue: cancellationFeeType === 'first_night' ? nightlyPrice : cancellationFeeValue,
              }
            : {}),
          ...(hasNoShowFee
            ? {
                noShowFeeType,
                noShowFeeValue: noShowFeeType === 'first_night' ? nightlyPrice : noShowFeeValue,
              }
            : {}),
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
    <Modal title="Yangi narx rejasi" onClose={onClose}>
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
        <Field label="Nomi">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Masalan: Korporativ tarif"
          />
        </Field>
        <Field label="Kechalik narx">
          <input
            required
            inputMode="decimal"
            value={nightlyPrice}
            onChange={(e) => setNightlyPrice(e.target.value)}
            className="input"
            placeholder="650000"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isRefundable} onChange={(e) => setIsRefundable(e.target.checked)} />
          Qaytariladigan (refundable)
        </label>
        <Field label="Tavsif (ixtiyoriy)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
        </Field>

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hasCancellationPolicy}
              onChange={(e) => setHasCancellationPolicy(e.target.checked)}
            />
            Bekor qilish siyosati (jarima)
          </label>
          {hasCancellationPolicy && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <Field label="Muddat (kun)">
                <input
                  type="number"
                  min={0}
                  value={cancellationDeadlineDays}
                  onChange={(e) => setCancellationDeadlineDays(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Jarima turi">
                <select
                  value={cancellationFeeType}
                  onChange={(e) => setCancellationFeeType(e.target.value as CancellationFeeType)}
                  className="input"
                >
                  {Object.entries(CANCELLATION_FEE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {cancellationFeeType !== 'first_night' && (
                <div className="col-span-2">
                  <Field label={cancellationFeeType === 'percent_of_total' ? 'Foiz (%)' : "Summa"}>
                    <input
                      inputMode="decimal"
                      value={cancellationFeeValue}
                      onChange={(e) => setCancellationFeeValue(e.target.value)}
                      className="input"
                      placeholder={cancellationFeeType === 'percent_of_total' ? '50' : '100000'}
                    />
                  </Field>
                </div>
              )}
              <p className="col-span-2 text-xs text-slate-400">
                Check-in sanasidan shu necha kun oldingacha bepul bekor qilish mumkin, keyin jarima olinadi.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={hasNoShowFee} onChange={(e) => setHasNoShowFee(e.target.checked)} />
            Kelmaslik (no-show) jarimasi
          </label>
          {hasNoShowFee && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <Field label="Jarima turi">
                <select
                  value={noShowFeeType}
                  onChange={(e) => setNoShowFeeType(e.target.value as CancellationFeeType)}
                  className="input"
                >
                  {Object.entries(CANCELLATION_FEE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {noShowFeeType !== 'first_night' && (
                <Field label={noShowFeeType === 'percent_of_total' ? 'Foiz (%)' : 'Summa'}>
                  <input
                    inputMode="decimal"
                    value={noShowFeeValue}
                    onChange={(e) => setNoShowFeeValue(e.target.value)}
                    className="input"
                    placeholder={noShowFeeType === 'percent_of_total' ? '100' : '100000'}
                  />
                </Field>
              )}
              <p className="col-span-2 text-xs text-slate-400">
                Night Audit mehmon kelmaganini aniqlaganda avtomatik qo'llanadi (muddatsiz).
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

function RatePlanRestrictionsModal({
  propertyId,
  ratePlan,
  onClose,
}: {
  propertyId: string;
  ratePlan: RatePlanDto;
  onClose: () => void;
}) {
  const [restrictions, setRestrictions] = useState<RatePlanRestrictionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState('');
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);
  const [stopSell, setStopSell] = useState(false);
  const [minLengthOfStay, setMinLengthOfStay] = useState('');
  const [maxLengthOfStay, setMaxLengthOfStay] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<RatePlanRestrictionDto[]>(
        `/properties/${propertyId}/rate-plans/${ratePlan.id}/restrictions`,
      );
      setRestrictions(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Cheklovlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratePlan.id]);

  const loadIntoForm = (r: RatePlanRestrictionDto) => {
    setDate(r.date.slice(0, 10));
    setClosedToArrival(r.closedToArrival);
    setClosedToDeparture(r.closedToDeparture);
    setStopSell(r.stopSell);
    setMinLengthOfStay(r.minLengthOfStay != null ? String(r.minLengthOfStay) : '');
    setMaxLengthOfStay(r.maxLengthOfStay != null ? String(r.maxLengthOfStay) : '');
  };

  const resetForm = () => {
    setDate('');
    setClosedToArrival(false);
    setClosedToDeparture(false);
    setStopSell(false);
    setMinLengthOfStay('');
    setMaxLengthOfStay('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/rate-plans/${ratePlan.id}/restrictions/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          closedToArrival,
          closedToDeparture,
          stopSell,
          minLengthOfStay: minLengthOfStay ? Number(minLengthOfStay) : undefined,
          maxLengthOfStay: maxLengthOfStay ? Number(maxLengthOfStay) : undefined,
        }),
      });
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Cheklovlar — ${ratePlan.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 mb-4 pb-4 border-b border-slate-100">
        <Field label="Sana">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min. turish (kecha)">
            <input
              type="number"
              min={1}
              value={minLengthOfStay}
              onChange={(e) => setMinLengthOfStay(e.target.value)}
              className="input"
              placeholder="Cheklovsiz"
            />
          </Field>
          <Field label="Max. turish (kecha)">
            <input
              type="number"
              min={1}
              value={maxLengthOfStay}
              onChange={(e) => setMaxLengthOfStay(e.target.value)}
              className="input"
              placeholder="Cheklovsiz"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={closedToArrival} onChange={(e) => setClosedToArrival(e.target.checked)} />
          Kelish yopiq (Closed to Arrival)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={closedToDeparture}
            onChange={(e) => setClosedToDeparture(e.target.checked)}
          />
          Jo'nab ketish yopiq (Closed to Departure)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={stopSell} onChange={(e) => setStopSell(e.target.checked)} />
          Sotuvdan yopish (Stop Sell)
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>

      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {loading && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
        {!loading && restrictions.length === 0 && (
          <p className="text-sm text-slate-500">Hali cheklov qo'yilmagan</p>
        )}
        {restrictions.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => loadIntoForm(r)}
            className="w-full text-left py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
          >
            <span className="font-medium text-slate-800">{r.date.slice(0, 10)}</span>
            <span className="text-xs text-slate-500">
              {[
                r.stopSell && 'Stop Sell',
                r.closedToArrival && 'CTA',
                r.closedToDeparture && 'CTD',
                r.minLengthOfStay && `Min ${r.minLengthOfStay}`,
                r.maxLengthOfStay && `Max ${r.maxLengthOfStay}`,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </span>
          </button>
        ))}
      </div>
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
