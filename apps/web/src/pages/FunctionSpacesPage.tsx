import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { FunctionSpaceBookingDto, FunctionSpaceBookingStatus, FunctionSpaceDto } from '../lib/types';

type Tab = 'spaces' | 'bookings';

const STATUS_LABELS: Record<FunctionSpaceBookingStatus, string> = {
  tentative: 'Dastlabki band',
  confirmed: 'Tasdiqlangan',
  cancelled: 'Bekor qilingan',
};

const STATUS_COLORS: Record<FunctionSpaceBookingStatus, string> = {
  tentative: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FunctionSpacesPage() {
  const { property, can } = useAuth();
  const [tab, setTab] = useState<Tab>('spaces');
  const [spaces, setSpaces] = useState<FunctionSpaceDto[]>([]);
  const [bookings, setBookings] = useState<FunctionSpaceBookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spaceForm, setSpaceForm] = useState<FunctionSpaceDto | 'new' | null>(null);
  const [bookingForm, setBookingForm] = useState<FunctionSpaceBookingDto | 'new' | null>(null);

  const canCreate = can('booking', 'create');
  const canEdit = can('booking', 'edit') || canCreate;

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [spaceList, bookingList] = await Promise.all([
        apiFetch<FunctionSpaceDto[]>(`/properties/${property.id}/function-spaces`),
        apiFetch<FunctionSpaceBookingDto[]>(`/properties/${property.id}/function-space-bookings`),
      ]);
      setSpaces(spaceList);
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
  }, [property?.id]);

  const spaceMap = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  return (
    <AppLayout title="Tadbir zallari">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-full p-1">
          <button
            onClick={() => setTab('spaces')}
            className={`px-3 py-1.5 text-sm rounded-full font-medium ${tab === 'spaces' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            Zallar
          </button>
          <button
            onClick={() => setTab('bookings')}
            className={`px-3 py-1.5 text-sm rounded-full font-medium ${tab === 'bookings' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            Tadbir bronlari
          </button>
        </div>
        {canCreate && tab === 'spaces' && (
          <button onClick={() => setSpaceForm('new')} className="btn-primary shrink-0">
            + Yangi zal
          </button>
        )}
        {canCreate && tab === 'bookings' && (
          <button onClick={() => setBookingForm('new')} className="btn-primary shrink-0" disabled={spaces.length === 0}>
            + Yangi tadbir
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : tab === 'spaces' ? (
        spaces.length === 0 ? (
          <p className="text-sm text-slate-500">Hali tadbir zali qo'shilmagan.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Nomi</th>
                  <th className="text-left px-4 py-2">Sig'imi</th>
                  <th className="text-left px-4 py-2">Kunlik narx</th>
                  <th className="text-left px-4 py-2">Holat</th>
                </tr>
              </thead>
              <tbody>
                {spaces.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSpaceForm(s)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.capacity} kishi</td>
                    <td className="px-4 py-3 text-slate-600">{Number(s.dailyRate).toLocaleString('uz-UZ')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.isActive ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : bookings.length === 0 ? (
        <p className="text-sm text-slate-500">Hali tadbir bron qilinmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Tadbir</th>
                <th className="text-left px-4 py-2">Zal</th>
                <th className="text-left px-4 py-2">Tashkilotchi</th>
                <th className="text-left px-4 py-2">Vaqt</th>
                <th className="text-left px-4 py-2">Holat</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setBookingForm(b)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{b.eventName}</td>
                  <td className="px-4 py-3 text-slate-600">{spaceMap.get(b.functionSpaceId)?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{b.organizerName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(b.startTime)} — {formatDateTime(b.endTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {spaceForm && property && (
        <FunctionSpaceFormModal
          propertyId={property.id}
          space={spaceForm === 'new' ? null : spaceForm}
          onClose={() => setSpaceForm(null)}
          onSaved={() => {
            setSpaceForm(null);
            load();
          }}
        />
      )}

      {bookingForm && property && (
        <FunctionSpaceBookingFormModal
          propertyId={property.id}
          spaces={spaces}
          booking={bookingForm === 'new' ? null : bookingForm}
          canEdit={canEdit}
          onClose={() => setBookingForm(null)}
          onSaved={() => {
            setBookingForm(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function FunctionSpaceFormModal({
  propertyId,
  space,
  onClose,
  onSaved,
}: {
  propertyId: string;
  space: FunctionSpaceDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = space !== null;
  const [name, setName] = useState(space?.name ?? '');
  const [capacity, setCapacity] = useState(String(space?.capacity ?? '50'));
  const [dailyRate, setDailyRate] = useState(space?.dailyRate ?? '0');
  const [description, setDescription] = useState(space?.description ?? '');
  const [isActive, setIsActive] = useState(space?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name,
        capacity: Number(capacity),
        dailyRate: dailyRate || undefined,
        description: description || undefined,
        ...(isEdit ? { isActive } : {}),
      };
      if (isEdit) {
        await apiFetch(`/properties/${propertyId}/function-spaces/${space.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/properties/${propertyId}/function-spaces`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Zalni tahrirlash' : 'Yangi tadbir zali'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Masalan: Katta banket zali" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Sig'imi (kishi)</span>
            <input
              type="number"
              min="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Kunlik ijara narxi</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Tavsif (ixtiyoriy)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Faol
          </label>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Zal yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FunctionSpaceBookingFormModal({
  propertyId,
  spaces,
  booking,
  canEdit,
  onClose,
  onSaved,
}: {
  propertyId: string;
  spaces: FunctionSpaceDto[];
  booking: FunctionSpaceBookingDto | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = booking !== null;
  const [functionSpaceId, setFunctionSpaceId] = useState(booking?.functionSpaceId ?? spaces[0]?.id ?? '');
  const [eventName, setEventName] = useState(booking?.eventName ?? '');
  const [organizerName, setOrganizerName] = useState(booking?.organizerName ?? '');
  const [organizerPhone, setOrganizerPhone] = useState(booking?.organizerPhone ?? '');
  const [organizerEmail, setOrganizerEmail] = useState(booking?.organizerEmail ?? '');
  const [startTime, setStartTime] = useState(booking ? toLocalInputValue(booking.startTime) : '');
  const [endTime, setEndTime] = useState(booking ? toLocalInputValue(booking.endTime) : '');
  const [attendeeCount, setAttendeeCount] = useState(booking?.attendeeCount ? String(booking.attendeeCount) : '');
  const [setupStyle, setSetupStyle] = useState(booking?.setupStyle ?? '');
  const [totalAmount, setTotalAmount] = useState(booking?.totalAmount ?? '');
  const [notes, setNotes] = useState(booking?.notes ?? '');
  const [status, setStatus] = useState<FunctionSpaceBookingStatus>(booking?.status ?? 'confirmed');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        functionSpaceId,
        eventName,
        organizerName,
        organizerPhone: organizerPhone || undefined,
        organizerEmail: organizerEmail || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        attendeeCount: attendeeCount ? Number(attendeeCount) : undefined,
        setupStyle: setupStyle || undefined,
        totalAmount: totalAmount || undefined,
        notes: notes || undefined,
        ...(isEdit ? { status } : {}),
      };
      if (isEdit) {
        await apiFetch(`/properties/${propertyId}/function-space-bookings/${booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/properties/${propertyId}/function-space-bookings`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Tadbir bronini tahrirlash' : 'Yangi tadbir bron'} onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Zal</span>
          <select
            value={functionSpaceId}
            onChange={(e) => setFunctionSpaceId(e.target.value)}
            className="input"
            required
            disabled={!canEdit}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.capacity} kishi)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Tadbir nomi</span>
          <input
            required
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="input"
            placeholder="Masalan: ACME yillik konferensiyasi"
            disabled={!canEdit}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Boshlanish vaqti</span>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input"
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Tugash vaqti</span>
            <input
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input"
              min={startTime || undefined}
              disabled={!canEdit}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Tashkilotchi</span>
            <input
              required
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="input"
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Telefon (ixtiyoriy)</span>
            <input value={organizerPhone} onChange={(e) => setOrganizerPhone(e.target.value)} className="input" disabled={!canEdit} />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Email (ixtiyoriy)</span>
          <input
            type="email"
            value={organizerEmail}
            onChange={(e) => setOrganizerEmail(e.target.value)}
            className="input"
            disabled={!canEdit}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Mehmonlar soni (ixtiyoriy)</span>
            <input
              type="number"
              min="1"
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(e.target.value)}
              className="input"
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Joylashuv turi (ixtiyoriy)</span>
            <input
              value={setupStyle}
              onChange={(e) => setSetupStyle(e.target.value)}
              className="input"
              placeholder="Teatr, Banket, U-shakl..."
              disabled={!canEdit}
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Jami summa (ixtiyoriy)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="input"
            disabled={!canEdit}
          />
        </label>
        {isEdit && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Holat</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FunctionSpaceBookingStatus)}
              className="input"
              disabled={!canEdit}
            >
              <option value="tentative">Dastlabki band</option>
              <option value="confirmed">Tasdiqlangan</option>
              <option value="cancelled">Bekor qilingan</option>
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} disabled={!canEdit} />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {canEdit && (
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Bron yaratish'}
          </button>
        )}
      </form>
    </Modal>
  );
}
