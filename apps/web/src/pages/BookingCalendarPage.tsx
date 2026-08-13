import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { CreateBookingModal } from '../components/CreateBookingModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { addDays, dateRange, formatDayLabel, toISODate } from '../lib/dates';
import type { BookingDto, BookingStatus, RoomDto } from '../lib/types';

const NUM_DAYS = 14;

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  checked_in: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  checked_out: 'bg-slate-100 text-slate-500 border-slate-300',
  cancelled: 'hidden',
  no_show: 'bg-rose-100 text-rose-800 border-rose-300',
};

type Segment =
  | { kind: 'empty'; span: 1; date: string }
  | { kind: 'booking'; booking: BookingDto; span: number; date: string };

function buildRoomSegments(dates: string[], bookings: BookingDto[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < dates.length) {
    const date = dates[i];
    const booking = bookings.find((b) => b.status !== 'cancelled' && b.checkIn <= date && date < b.checkOut);
    if (booking) {
      let span = 0;
      while (i + span < dates.length && dates[i + span] < booking.checkOut) span++;
      segments.push({ kind: 'booking', booking, span, date });
      i += span;
    } else {
      segments.push({ kind: 'empty', span: 1, date });
      i += 1;
    }
  }
  return segments;
}

export function BookingCalendarPage() {
  const { property, can } = useAuth();
  const [windowStart, setWindowStart] = useState(toISODate(new Date()));
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{ roomId?: string; checkIn?: string } | null>(null);
  const [detailBooking, setDetailBooking] = useState<BookingDto | null>(null);

  const dates = useMemo(() => dateRange(windowStart, NUM_DAYS), [windowStart]);
  const windowEnd = useMemo(() => addDays(windowStart, NUM_DAYS), [windowStart]);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [roomList, bookingList] = await Promise.all([
        apiFetch<RoomDto[]>(`/properties/${property.id}/rooms`),
        apiFetch<BookingDto[]>(`/properties/${property.id}/bookings?from=${windowStart}&to=${windowEnd}`),
      ]);
      setRooms(roomList);
      setBookings(bookingList);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, windowStart]);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, BookingDto[]>();
    for (const b of bookings) {
      if (!map.has(b.roomId)) map.set(b.roomId, []);
      map.get(b.roomId)!.push(b);
    }
    return map;
  }, [bookings]);

  return (
    <AppLayout title="Bronlar taqvimi">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWindowStart(addDays(windowStart, -NUM_DAYS))} className="btn-secondary">
            &larr;
          </button>
          <button onClick={() => setWindowStart(toISODate(new Date()))} className="btn-secondary">
            Bugun
          </button>
          <button onClick={() => setWindowStart(addDays(windowStart, NUM_DAYS))} className="btn-secondary">
            &rarr;
          </button>
          <span className="text-sm text-slate-500 ml-2">
            {dates[0]} — {dates[dates.length - 1]}
          </span>
        </div>
        {can('booking', 'create') && (
          <button onClick={() => setCreateModal({})} className="btn-primary">
            + Yangi bron
          </button>
        )}
      </div>

      <Legend />

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-slate-500">
          Hali xona qo'shilmagan — avval "Xonalar" bo'limidan xona qo'shing.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex">
            <div className="w-36 shrink-0 border-r border-slate-200">
              <div className="h-12 border-b border-slate-200" />
              {rooms.map((room) => (
                <div key={room.id} className="h-14 border-b border-slate-100 flex flex-col justify-center px-3">
                  <p className="text-sm font-semibold text-slate-900">№ {room.roomNumber}</p>
                  <p className="text-xs text-slate-500">{room.roomType?.name ?? ''}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto">
              <div
                className="grid h-12 border-b border-slate-200"
                style={{ gridTemplateColumns: `repeat(${NUM_DAYS}, minmax(64px, 1fr))` }}
              >
                {dates.map((d) => {
                  const { weekday, dayMonth } = formatDayLabel(d);
                  return (
                    <div
                      key={d}
                      className="flex flex-col items-center justify-center border-l border-slate-100 text-xs text-slate-500"
                    >
                      <span>{weekday}</span>
                      <span className="font-medium text-slate-700">{dayMonth}</span>
                    </div>
                  );
                })}
              </div>

              {rooms.map((room) => {
                const segments = buildRoomSegments(dates, bookingsByRoom.get(room.id) ?? []);
                return (
                  <div
                    key={room.id}
                    className="grid h-14 border-b border-slate-100"
                    style={{ gridTemplateColumns: `repeat(${NUM_DAYS}, minmax(64px, 1fr))` }}
                  >
                    {segments.map((seg, idx) =>
                      seg.kind === 'empty' ? (
                        <button
                          key={idx}
                          onClick={() => can('booking', 'create') && setCreateModal({ roomId: room.id, checkIn: seg.date })}
                          className="border-l border-slate-100 hover:bg-slate-50 h-full"
                          title={seg.date}
                        />
                      ) : (
                        <button
                          key={idx}
                          onClick={() => setDetailBooking(seg.booking)}
                          style={{ gridColumn: `span ${seg.span}` }}
                          className={`border-l m-1 rounded-md px-2 text-left text-xs font-medium truncate ${STATUS_COLORS[seg.booking.status]}`}
                        >
                          {seg.booking.guest?.fullName ?? 'Mehmon'}
                        </button>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {createModal && property && (
        <CreateBookingModal
          propertyId={property.id}
          rooms={rooms}
          presetRoomId={createModal.roomId}
          presetCheckIn={createModal.checkIn}
          onClose={() => setCreateModal(null)}
          onCreated={() => {
            setCreateModal(null);
            load();
          }}
        />
      )}

      {detailBooking && property && (
        <BookingDetailModal
          propertyId={property.id}
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onChanged={() => {
            setDetailBooking(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
      <LegendItem color="bg-blue-100 border-blue-300" label="Tasdiqlangan" />
      <LegendItem color="bg-emerald-100 border-emerald-300" label="Joylashtirilgan" />
      <LegendItem color="bg-slate-100 border-slate-300" label="Chiqib ketgan" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded border ${color}`} />
      {label}
    </span>
  );
}
