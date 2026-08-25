import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { GuestPicker } from './GuestPicker';
import { apiFetch, ApiError } from '../lib/api';
import { addDays } from '../lib/dates';
import type { GuestDto, RatePlanDto, RoomTypeDto } from '../lib/types';

export function AddGroupRoomModal({
  propertyId,
  groupId,
  onClose,
  onAdded,
}: {
  propertyId: string;
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [roomTypes, setRoomTypes] = useState<RoomTypeDto[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanDto[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [guest, setGuest] = useState<GuestDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<RoomTypeDto[]>(`/properties/${propertyId}/room-types`),
      apiFetch<RatePlanDto[]>(`/properties/${propertyId}/rate-plans`),
    ]).then(([types, plans]) => {
      setRoomTypes(types);
      setRatePlans(plans);
      if (types.length > 0) setRoomTypeId(types[0].id);
    });
  }, [propertyId]);

  const applicableRatePlans = ratePlans.filter((rp) => rp.isActive && rp.roomTypeId === roomTypeId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guest) {
      setError('Mehmonni tanlang');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/booking-groups/${groupId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId,
          guestId: guest.id,
          ratePlanId: ratePlanId || undefined,
          checkIn,
          checkOut,
        }),
      });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Guruhga xona qo'shish" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Xona turi</span>
          <select
            value={roomTypeId}
            onChange={(e) => {
              setRoomTypeId(e.target.value);
              setRatePlanId('');
            }}
            className="input"
            required
          >
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Check-in</span>
            <input
              type="date"
              required
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Check-out</span>
            <input
              type="date"
              required
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="input"
              min={checkIn || undefined}
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Narx rejasi</span>
          <select value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)} className="input">
            <option value="">Bazaviy narx (xona turi bo'yicha)</option>
            {applicableRatePlans.map((rp) => (
              <option key={rp.id} value={rp.id}>
                {rp.name} — {Number(rp.nightlyPrice).toLocaleString('uz-UZ')} / kecha
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Mehmon</span>
          <GuestPicker value={guest} onChange={setGuest} />
        </label>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : "Xonani qo'shish"}
        </button>
      </form>
    </Modal>
  );
}
