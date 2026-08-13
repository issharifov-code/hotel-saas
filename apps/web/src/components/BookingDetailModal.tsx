import { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingDto, BookingStatus } from '../lib/types';

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
  onClose,
  onChanged,
}: {
  propertyId: string;
  booking: BookingDto;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const canCheckInOut = can('front_desk', 'approve');
  const canEditBooking = can('booking', 'edit');

  return (
    <Modal title={`Bron — № ${booking.room?.roomNumber ?? ''}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Row label="Mehmon" value={booking.guest?.fullName ?? '—'} />
        <Row label="Sana" value={`${booking.checkIn} — ${booking.checkOut}`} />
        <Row label="Holat" value={STATUS_LABELS[booking.status]} />
        <Row label="Summa" value={`${Number(booking.totalAmount).toLocaleString('uz-UZ')} ${booking.currency}`} />
        {booking.notes && <Row label="Izoh" value={booking.notes} />}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex gap-2 pt-2">
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
          {(booking.status === 'confirmed' || booking.status === 'pending') && canEditBooking && (
            <button disabled={submitting} onClick={() => act('cancel')} className="btn-secondary">
              Bekor qilish
            </button>
          )}
        </div>
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
