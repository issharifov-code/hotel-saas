import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { GuestPicker } from './GuestPicker';
import { apiFetch, ApiError } from '../lib/api';
import { addDays } from '../lib/dates';
import type { GuestDto, RatePlanDto, RoomTypeDto } from '../lib/types';

interface RoomRow {
  roomTypeId: string;
  guest: GuestDto | null;
  ratePlanId: string;
}

function emptyRow(defaultRoomTypeId: string): RoomRow {
  return { roomTypeId: defaultRoomTypeId, guest: null, ratePlanId: '' };
}

export function CreateGroupBookingModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [groupName, setGroupName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [roomTypes, setRoomTypes] = useState<RoomTypeDto[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanDto[]>([]);
  const [rows, setRows] = useState<RoomRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<RoomTypeDto[]>(`/properties/${propertyId}/room-types`),
      apiFetch<RatePlanDto[]>(`/properties/${propertyId}/rate-plans`),
    ]).then(([types, plans]) => {
      setRoomTypes(types);
      setRatePlans(plans);
      if (types.length > 0) setRows([emptyRow(types[0].id), emptyRow(types[0].id)]);
    });
  }, [propertyId]);

  const updateRow = (idx: number, patch: Partial<RoomRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(roomTypes[0]?.id ?? '')]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      setError('Kamida bitta xona qo\'shing');
      return;
    }
    if (rows.some((r) => !r.guest)) {
      setError('Har bir xona uchun mehmonni tanlang');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/booking-groups`, {
        method: 'POST',
        body: JSON.stringify({
          groupName,
          companyName: companyName || undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          notes: notes || undefined,
          checkIn,
          checkOut,
          rooms: rows.map((r) => ({
            roomTypeId: r.roomTypeId,
            guestId: r.guest!.id,
            ratePlanId: r.ratePlanId || undefined,
          })),
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
    <Modal title="Yangi guruh bron" onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Guruh nomi</span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={200}
              className="input"
              placeholder="Masalan: ACME konferensiyasi"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Kompaniya (ixtiyoriy)</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={200} className="input" />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa shaxsi</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={200} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={50} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={200} className="input" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Check-in (barcha xonalar uchun)</span>
            <input
              type="date"
              required
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Check-out (barcha xonalar uchun)</span>
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Xonalar ro'yxati (rooming list)</span>
            <button type="button" onClick={addRow} className="btn-secondary text-xs px-2 py-1">
              + Xona qo'shish
            </button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {rows.map((row, idx) => {
              const applicableRatePlans = ratePlans.filter(
                (rp) => rp.isActive && rp.roomTypeId === row.roomTypeId,
              );
              return (
                <div key={idx} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Xona #{idx + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        O'chirish
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={row.roomTypeId}
                      onChange={(e) => updateRow(idx, { roomTypeId: e.target.value, ratePlanId: '' })}
                      className="input"
                    >
                      {roomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.ratePlanId}
                      onChange={(e) => updateRow(idx, { ratePlanId: e.target.value })}
                      className="input"
                    >
                      <option value="">Bazaviy narx</option>
                      {applicableRatePlans.map((rp) => (
                        <option key={rp.id} value={rp.id}>
                          {rp.name} — {Number(rp.nightlyPrice).toLocaleString('uz-UZ')} / kecha
                        </option>
                      ))}
                    </select>
                  </div>
                  <GuestPicker value={row.guest} onChange={(g) => updateRow(idx, { guest: g })} />
                </div>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="input" rows={2} />
        </label>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : `Guruh bron yaratish (${rows.length} ta xona)`}
        </button>
      </form>
    </Modal>
  );
}
