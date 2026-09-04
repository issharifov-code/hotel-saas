import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { ProfilePicker } from './ProfilePicker';
import { GuestPicker } from './GuestPicker';
import { apiFetch, ApiError } from '../lib/api';
import { addDays } from '../lib/dates';
import type { AgencyDto, CorporateAccountDto, GuestDto, MarketSegment, RatePlanDto, RoomDto } from '../lib/types';

const MARKET_SEGMENT_LABELS: Record<MarketSegment, string> = {
  walk_in: 'Walk-in',
  corporate: 'Korporativ',
  ota: 'OTA (Booking.com va h.k.)',
  travel_agent: 'Turizm agentligi',
  group: 'Guruh',
  government: "Davlat tashkiloti",
  other: 'Boshqa',
};

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
  const [ratePlans, setRatePlans] = useState<RatePlanDto[]>([]);
  const [ratePlanId, setRatePlanId] = useState<string>('');
  const [agencies, setAgencies] = useState<AgencyDto[]>([]);
  const [agencyId, setAgencyId] = useState<string>('');
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccountDto[]>([]);
  const [corporateAccountId, setCorporateAccountId] = useState<string>('');
  const [marketSegment, setMarketSegment] = useState<MarketSegment>('other');
  const [marketSegmentTouched, setMarketSegmentTouched] = useState(false);
  // Bron MANBASI — nomlangan profil (2026-09-04). Pastdagi "Kanal"
  // (source enum) bilan aralashtirmaslik kerak: kanal — texnik yo'l,
  // manba — kim/nima olib keldi.
  const [sourceProfileId, setSourceProfileId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<RatePlanDto[]>(`/properties/${propertyId}/rate-plans`)
      .then(setRatePlans)
      .catch(() => setRatePlans([]));
    apiFetch<AgencyDto[]>(`/properties/${propertyId}/agencies`)
      .then((list) => setAgencies(list.filter((a) => a.isActive)))
      .catch(() => setAgencies([]));
    apiFetch<CorporateAccountDto[]>(`/properties/${propertyId}/corporate-accounts`)
      .then((list) => setCorporateAccounts(list.filter((a) => a.isActive)))
      .catch(() => setCorporateAccounts([]));
  }, [propertyId]);

  // Agentlik yoki korporativ hisob tanlansa va foydalanuvchi bozor segmentini
  // qo'lda o'zgartirmagan bo'lsa, backend'dagi avtomatik xatti-harakatni
  // frontend'da ham aks ettirish uchun segmentni mos ravishda o'rnatamiz
  // (backend'dagi ustuvorlik bilan bir xil — agentlik korporativ hisobdan
  // ustun turadi, ikkalasi ham berilgan kamdan-kam holat uchun).
  useEffect(() => {
    if (marketSegmentTouched) return;
    setMarketSegment(agencyId ? 'travel_agent' : corporateAccountId ? 'corporate' : 'other');
  }, [agencyId, corporateAccountId, marketSegmentTouched]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  // Faqat tanlangan xonaning turiga mos, faol narx rejalari ko'rsatiladi.
  const applicableRatePlans = ratePlans.filter(
    (rp) => rp.isActive && rp.roomTypeId === selectedRoom?.roomTypeId,
  );

  useEffect(() => {
    // Xona (demak xona turi) o'zgarsa, oldingi tanlangan reja endi mos
    // kelmasligi mumkin — shunday holatda "Bazaviy narx" (hech narsa
    // tanlanmagan) holatiga qaytariladi.
    if (ratePlanId && !applicableRatePlans.some((rp) => rp.id === ratePlanId)) {
      setRatePlanId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, ratePlans]);

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
          ratePlanId: ratePlanId || undefined,
          agencyId: agencyId || undefined,
          corporateAccountId: corporateAccountId || undefined,
          sourceProfileId: sourceProfileId || undefined,
          marketSegment,
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

        <div className="grid grid-cols-2 gap-3">
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
            <span className="block text-xs font-medium text-slate-600 mb-1">Bozor segmenti</span>
            <select
              value={marketSegment}
              onChange={(e) => {
                setMarketSegment(e.target.value as MarketSegment);
                setMarketSegmentTouched(true);
              }}
              className="input"
            >
              {(Object.keys(MARKET_SEGMENT_LABELS) as MarketSegment[]).map((seg) => (
                <option key={seg} value={seg}>
                  {MARKET_SEGMENT_LABELS[seg]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {agencies.length > 0 && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Agentlik (ixtiyoriy)</span>
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="input">
              <option value="">— Yo'q —</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({Number(a.commissionPct)}% komissiya)
                </option>
              ))}
            </select>
          </label>
        )}

        <ProfilePicker
          type="source"
          value={sourceProfileId}
          onChange={setSourceProfileId}
          label="Manba (ixtiyoriy)"
          hint="Bronni kim/nima olib keldi — masalan reklama yoki hamkor"
        />

        {corporateAccounts.length > 0 && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Korporativ hisob (City Ledger, ixtiyoriy)
            </span>
            <select
              value={corporateAccountId}
              onChange={(e) => setCorporateAccountId(e.target.value)}
              className="input"
            >
              <option value="">— Yo'q —</option>
              {corporateAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.paymentTermsDays} kunlik to'lov muddati)
                </option>
              ))}
            </select>
          </label>
        )}

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
