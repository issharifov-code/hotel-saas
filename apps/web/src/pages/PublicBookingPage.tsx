import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { addDays, toISODate } from '../lib/dates';
import type {
  PublicAvailabilityDto,
  PublicBookingResultDto,
  PublicPropertyDto,
  PublicRatePlanDto,
} from '../lib/types';

// Booking Engine — OTA komissiyasisiz, to'g'ridan-to'g'ri (direct) jonli bron
// widget'i. Autentifikatsiya talab qilinmaydi (mehmon uchun ochiq) — barcha
// so'rovlar `auth: false` bilan yuboriladi, tenant esa URL'dagi subdomain
// orqali (backend'dagi `PublicTenantGuard`) aniqlanadi.
export function PublicBookingPage() {
  const { subdomain } = useParams<{ subdomain: string }>();

  const [properties, setProperties] = useState<PublicPropertyDto[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState(toISODate(new Date()));
  const [checkOut, setCheckOut] = useState(addDays(toISODate(new Date()), 1));
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<PublicAvailabilityDto[] | null>(null);

  const [bookingTarget, setBookingTarget] = useState<{
    roomType: PublicAvailabilityDto;
    ratePlan: PublicRatePlanDto | null;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<PublicBookingResultDto | null>(null);

  useEffect(() => {
    if (!subdomain) return;
    (async () => {
      try {
        const props = await apiFetch<PublicPropertyDto[]>(`/public/${subdomain}/properties`, {
          auth: false,
        });
        setProperties(props);
        if (props.length > 0) setPropertyId(props[0].id);
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : 'Mehmonxona topilmadi');
      } finally {
        setLoadingProperties(false);
      }
    })();
  }, [subdomain]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const data = await apiFetch<PublicAvailabilityDto[]>(
        `/public/${subdomain}/properties/${propertyId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`,
        { auth: false },
      );
      setResults(data);
    } catch (e) {
      setSearchError(e instanceof ApiError ? e.message : 'Qidirishda xatolik');
    } finally {
      setSearching(false);
    }
  };

  if (loadingProperties) {
    return <CenteredMessage text="Yuklanmoqda..." />;
  }
  if (loadError) {
    return <CenteredMessage text={loadError} isError />;
  }

  if (confirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="text-3xl mb-3">✓</div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Bron qabul qilindi</h1>
          <p className="text-sm text-slate-500 mb-6">
            Bron so'rovingiz mehmonxonaga yuborildi va hozir "kutilmoqda" holatida — xodim tez orada
            tasdiqlaydi.
          </p>
          <div className="text-sm text-left bg-slate-50 rounded-lg p-4 space-y-2">
            <Row label="Sana" value={`${confirmation.checkIn} — ${confirmation.checkOut}`} />
            <Row
              label="Summa"
              value={`${Number(confirmation.totalAmount).toLocaleString('uz-UZ')} ${confirmation.currency}`}
            />
            <Row label="Holat" value="Kutilmoqda" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">To'g'ridan-to'g'ri bron</h1>
        <p className="text-sm text-slate-500 mb-6">
          Vositachisiz, to'g'ridan-to'g'ri mehmonxona bilan bron qiling.
        </p>

        <form onSubmit={search} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {properties.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Filial</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input">
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kirish sanasi</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Chiqish sanasi</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="input"
              />
            </div>
          </div>
          {searchError && <p className="text-sm text-rose-600">{searchError}</p>}
          <button type="submit" disabled={searching} className="btn-primary w-full">
            {searching ? 'Qidirilmoqda...' : "Bo'sh xonalarni ko'rsatish"}
          </button>
        </form>

        {results && (
          <div className="mt-6 space-y-3">
            {results.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">
                Tanlangan sanalarda bo'sh xona topilmadi.
              </p>
            )}
            {results.map((rt) => (
              <div key={rt.roomTypeId} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-slate-900">{rt.name}</h3>
                    {rt.description && <p className="text-xs text-slate-500 mt-0.5">{rt.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      Sig'im: {rt.maxOccupancy} kishi · {rt.availableCount} ta bo'sh xona
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-slate-400">tundan boshlab</div>
                    <div className="font-semibold text-slate-900">
                      {rt.nightlyPriceFrom.toLocaleString('uz-UZ')} UZS
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {rt.ratePlans.length === 0 ? (
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() => setBookingTarget({ roomType: rt, ratePlan: null })}
                    >
                      Band qilish
                    </button>
                  ) : (
                    rt.ratePlans.map((rp) => (
                      <div
                        key={rp.id}
                        className="flex items-center justify-between border border-slate-100 rounded-md px-3 py-2"
                      >
                        <div>
                          <span className="text-sm text-slate-800">{rp.name}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            {rp.isRefundable ? "qaytariladigan" : "qaytarilmaydigan"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-900">
                            {Number(rp.nightlyPrice).toLocaleString('uz-UZ')} UZS
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setBookingTarget({ roomType: rt, ratePlan: rp })}
                          >
                            Tanlash
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bookingTarget && subdomain && propertyId && (
        <GuestInfoModal
          subdomain={subdomain}
          propertyId={propertyId}
          checkIn={checkIn}
          checkOut={checkOut}
          roomType={bookingTarget.roomType}
          ratePlan={bookingTarget.ratePlan}
          onClose={() => setBookingTarget(null)}
          onSuccess={(res) => {
            setBookingTarget(null);
            setConfirmation(res);
          }}
        />
      )}
    </div>
  );
}

function GuestInfoModal({
  subdomain,
  propertyId,
  checkIn,
  checkOut,
  roomType,
  ratePlan,
  onClose,
  onSuccess,
}: {
  subdomain: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  roomType: PublicAvailabilityDto;
  ratePlan: PublicRatePlanDto | null;
  onClose: () => void;
  onSuccess: (res: PublicBookingResultDto) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone && !email) {
      setError('Telefon raqami yoki email manzilidan kamida bittasi kerak');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<PublicBookingResultDto>(
        `/public/${subdomain}/properties/${propertyId}/bookings`,
        {
          method: 'POST',
          auth: false,
          body: JSON.stringify({
            roomTypeId: roomType.roomTypeId,
            ratePlanId: ratePlan?.id,
            checkIn,
            checkOut,
            guestFullName: fullName,
            guestPhone: phone || undefined,
            guestEmail: email || undefined,
            notes: notes || undefined,
          }),
        },
      );
      onSuccess(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Bron yaratishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Mehmon ma'lumotlari</h2>
        <p className="text-xs text-slate-500 mb-4">
          {roomType.name}
          {ratePlan ? ` — ${ratePlan.name}` : ''} · {checkIn} — {checkOut}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="To'liq ism" value={fullName} onChange={setFullName} required />
          <Field label="Telefon" value={phone} onChange={setPhone} placeholder="+998 90 123-45-67" />
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Bekor qilish
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Yuborilmoqda...' : 'Bron qilish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="input"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}

function CenteredMessage({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className={isError ? 'text-rose-600' : 'text-slate-500'}>{text}</p>
    </div>
  );
}
