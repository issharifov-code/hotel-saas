import { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingDto, BookingStatus, RoomDto } from '../lib/types';

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Kutilmoqda',
  confirmed: 'Tasdiqlangan',
  checked_in: 'Joylashtirilgan',
  checked_out: 'Chiqib ketgan',
  cancelled: 'Bekor qilingan',
  no_show: 'Kelmadi',
};

export function BookingDetailModal({
  propertyId,
  booking,
  rooms,
  onClose,
  onChanged,
}: {
  propertyId: string;
  booking: BookingDto;
  rooms: RoomDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showChangeRoom, setShowChangeRoom] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  const [showEditDates, setShowEditDates] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState(booking.checkIn);
  const [newCheckOut, setNewCheckOut] = useState(booking.checkOut);

  const act = async (action: 'check-in' | 'check-out' | 'cancel') => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/bookings/${booking.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const submitChangeRoom = async () => {
    if (!newRoomId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/bookings/${booking.id}/change-room`, {
        method: 'POST',
        body: JSON.stringify({ roomId: newRoomId }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEditDates = async () => {
    if (!newCheckIn || !newCheckOut) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/bookings/${booking.id}/update-dates`, {
        method: 'POST',
        body: JSON.stringify({ checkIn: newCheckIn, checkOut: newCheckOut }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const canCheckInOut = can('front_desk', 'approve');
  const canEditBooking = can('booking', 'edit');
  const canFrontDeskEdit = can('front_desk', 'edit');
  const canModify = ['confirmed', 'checked_in'].includes(booking.status) && canFrontDeskEdit;
  const otherRooms = rooms.filter((r) => r.id !== booking.roomId);

  return (
    <Modal title={`Bron — № ${booking.room?.roomNumber ?? ''}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Row label="Mehmon" value={booking.guest?.fullName ?? '—'} />
        <Row label="Sana" value={`${booking.checkIn} — ${booking.checkOut}`} />
        <Row label="Holat" value={STATUS_LABELS[booking.status]} />
        <Row label="Summa" value={`${Number(booking.totalAmount).toLocaleString('uz-UZ')} ${booking.currency}`} />
        {booking.notes && <Row label="Izoh" value={booking.notes} />}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-2">
          {booking.status === 'confirmed' && canCheckInOut && (
            <button disabled={submitting} onClick={() => act('check-in')} className="btn-primary">
              Check-in
            </button>
          )}
          {booking.status === 'checked_in' && canCheckInOut && (
            <button disabled={submitting} onClick={() => act('check-out')} className="btn-primary">
              Check-out
            </button>
          )}
          {canModify && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowChangeRoom((v) => !v);
                setShowEditDates(false);
              }}
              className="btn-secondary"
            >
              Xona almashtirish
            </button>
          )}
          {canModify && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowEditDates((v) => !v);
                setShowChangeRoom(false);
              }}
              className="btn-secondary"
            >
              Sanani o'zgartirish
            </button>
          )}
          {(booking.status === 'confirmed' || booking.status === 'pending') && canEditBooking && (
            <button disabled={submitting} onClick={() => act('cancel')} className="btn-secondary">
              Bekor qilish
            </button>
          )}
        </div>

        {showChangeRoom && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <span className="block text-xs font-medium text-slate-600">Yangi xona</span>
            <div className="flex gap-2">
              <select value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)} className="input flex-1">
                <option value="">Tanlang...</option>
                {otherRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    № {r.roomNumber} {r.roomType ? `— ${r.roomType.name}` : ''}
                  </option>
                ))}
              </select>
              <button type="button" disabled={submitting || !newRoomId} onClick={submitChangeRoom} className="btn-primary shrink-0">
                Ko'chirish
              </button>
            </div>
            {booking.status === 'checked_in' && (
              <p className="text-xs text-slate-400">
                Narx farqi (agar bo'lsa) hisob-fakturaga avtomatik tuzatish qatori sifatida qo'shiladi.
              </p>
            )}
          </div>
        )}

        {showEditDates && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <span className="block text-xs font-medium text-slate-600">Yangi sanalar</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={newCheckIn} onChange={(e) => setNewCheckIn(e.target.value)} className="input" />
              <input type="date" value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} className="input" />
            </div>
            <button type="button" disabled={submitting} onClick={submitEditDates} className="btn-primary w-full">
              Saqlash
            </button>
            {booking.status === 'checked_in' && (
              <p className="text-xs text-slate-400">
                Narx farqi (agar bo'lsa) hisob-fakturaga avtomatik tuzatish qatori sifatida qo'shiladi.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value}</span>
    </div>
  );
}
