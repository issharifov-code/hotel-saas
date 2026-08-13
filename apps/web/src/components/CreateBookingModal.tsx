import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { GuestPicker } from './GuestPicker';
import { apiFetch, ApiError } from '../lib/api';
import { addDays } from '../lib/dates';
import type { GuestDto, RoomDto } from '../lib/types';

export function CreateBookingModal({
  propertyId,
  rooms,
  presetRoomId,
  presetCheckIn,
  onClose,
  onCreated,
}: {
  propertyId: string;
  rooms: RoomDto[];
  presetRoomId?: string;
  presetCheckIn?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [roomId, setRoomId] = useState(presetRoomId ?? rooms[0]?.id ?? '');
  const [checkIn, setCheckIn] = useState(presetCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(presetCheckIn ? addDays(presetCheckIn, 1) : '');
  const [guest, setGuest] = useState<GuestDto | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guest) {
      setError('Mehmonni tanlang');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          guestId: guest.id,
          checkIn,
          checkOut,
          notes: notes || undefined,
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
    <Modal title="Yangi bron" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Xona</span>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input" required>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                № {r.roomNumber} {r.roomType ? `— ${r.roomType.name}` : ''}
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
          <span className="block text-xs font-medium text-slate-600 mb-1">Mehmon</span>
          <GuestPicker value={guest} onChange={setGuest} />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </label>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Bron qilish'}
        </button>
      </form>
    </Modal>
  );
}
