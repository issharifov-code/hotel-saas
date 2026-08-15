import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingDto, GuestDto, LoyaltyTier, LoyaltyTransactionDto } from '../lib/types';

const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  platinum: 'Platina',
};

const TIER_STYLES: Record<LoyaltyTier, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-amber-100 text-amber-800',
  platinum: 'bg-indigo-100 text-indigo-800',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Kutilmoqda',
  confirmed: 'Tasdiqlangan',
  checked_in: 'Joylashgan',
  checked_out: "Chiqib ketgan",
  cancelled: 'Bekor qilingan',
  no_show: 'Kelmadi',
};

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_STYLES[tier]}`}>{TIER_LABELS[tier]}</span>;
}

export function GuestsPage() {
  const { can } = useAuth();
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const path = q ? `/guests?search=${encodeURIComponent(q)}` : '/guests';
      setGuests(await apiFetch<GuestDto[]>(path));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <AppLayout title="Mehmonlar">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism, telefon yoki email bo'yicha qidirish..."
          className="input max-w-sm"
        />
        {can('guest_crm', 'create') && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            + Mehmon qo'shish
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {!loading && guests.length === 0 && <p className="p-4 text-sm text-slate-500">Mehmon topilmadi</p>}
        {guests.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGuestId(g.id)}
            className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900 flex items-center gap-2">
                {g.fullName}
                <TierBadge tier={g.loyaltyTier} />
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[g.phone, g.email, g.nationality].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <p className="text-xs text-slate-500 shrink-0">{g.loyaltyPoints} ball</p>
          </button>
        ))}
      </div>

      {showModal && (
        <CreateGuestModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load(search || undefined);
          }}
        />
      )}

      {selectedGuestId && (
        <GuestDetailModal
          guestId={selectedGuestId}
          onClose={() => setSelectedGuestId(null)}
          onChanged={() => load(search || undefined)}
        />
      )}
    </AppLayout>
  );
}

function CreateGuestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/guests', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
          nationality: nationality || undefined,
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
    <Modal title="Yangi mehmon" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To'liq ism</span>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+998..." />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Fuqarolik</span>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)} className="input" />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}

type DetailTab = 'profile' | 'loyalty' | 'stays';

function GuestDetailModal({ guestId, onClose, onChanged }: { guestId: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const canEdit = can('guest_crm', 'edit');
  const [tab, setTab] = useState<DetailTab>('profile');
  const [guest, setGuest] = useState<GuestDto | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransactionDto[]>([]);
  const [stays, setStays] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustForm, setShowAdjustForm] = useState(false);

  const loadGuest = async () => {
    setGuest(await apiFetch<GuestDto>(`/guests/${guestId}`));
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, tx, st] = await Promise.all([
        apiFetch<GuestDto>(`/guests/${guestId}`),
        apiFetch<LoyaltyTransactionDto[]>(`/guests/${guestId}/loyalty/transactions`),
        apiFetch<BookingDto[]>(`/guests/${guestId}/stays`),
      ]);
      setGuest(g);
      setTransactions(tx);
      setStays(st);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'profile', label: 'Profil' },
    { key: 'loyalty', label: 'Loyalty' },
    { key: 'stays', label: 'Turgan kunlari' },
  ];

  return (
    <Modal title={guest ? guest.fullName : 'Mehmon'} onClose={onClose} width="max-w-2xl">
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {loading || !guest ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TierBadge tier={guest.loyaltyTier} />
            <span className="text-sm text-slate-600">{guest.loyaltyPoints} ball (jami to'plangan: {guest.lifetimePoints})</span>
          </div>

          <div className="flex gap-1 mb-4 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${
                  tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <GuestProfileForm
              guest={guest}
              canEdit={canEdit}
              onSaved={async () => {
                await loadGuest();
                onChanged();
              }}
            />
          )}

          {tab === 'loyalty' && (
            <div>
              {canEdit && (
                <div className="mb-3">
                  {!showAdjustForm ? (
                    <button onClick={() => setShowAdjustForm(true)} className="btn-secondary">
                      Ballni qo'lda tuzatish
                    </button>
                  ) : (
                    <AdjustPointsForm
                      guestId={guestId}
                      onCancel={() => setShowAdjustForm(false)}
                      onAdjusted={async () => {
                        setShowAdjustForm(false);
                        await loadAll();
                        onChanged();
                      }}
                    />
                  )}
                </div>
              )}
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {transactions.length === 0 && <p className="p-3 text-sm text-slate-500">Hali ball tranzaksiyasi yo'q</p>}
                {transactions.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-900">{t.reason}</p>
                      <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString('uz-UZ')}</p>
                    </div>
                    <span className={`font-medium ${t.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.points >= 0 ? '+' : ''}
                      {t.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'stays' && (
            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
              {stays.length === 0 && <p className="p-3 text-sm text-slate-500">Hali turgan kunlari yo'q</p>}
              {stays.map((s) => (
                <div key={s.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">
                      {s.checkIn} — {s.checkOut}
                      {s.room && <span className="text-slate-500"> · {s.room.roomNumber}-xona</span>}
                    </p>
                    <span className="text-xs text-slate-500">{BOOKING_STATUS_LABELS[s.status] ?? s.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s.property?.name ?? ''} · {s.totalAmount} {s.currency}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function GuestProfileForm({ guest, canEdit, onSaved }: { guest: GuestDto; canEdit: boolean; onSaved: () => void }) {
  const [phone, setPhone] = useState(guest.phone ?? '');
  const [email, setEmail] = useState(guest.email ?? '');
  const [nationality, setNationality] = useState(guest.nationality ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(guest.dateOfBirth ?? '');
  const [notes, setNotes] = useState(guest.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/guests/${guest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: phone || undefined,
          email: email || undefined,
          nationality: nationality || undefined,
          dateOfBirth: dateOfBirth || undefined,
          notes: notes || undefined,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
          <input disabled={!canEdit} value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
          <input disabled={!canEdit} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Fuqarolik</span>
          <input disabled={!canEdit} value={nationality} onChange={(e) => setNationality(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Tug'ilgan sana</span>
          <input
            disabled={!canEdit}
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="input"
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (xona afzalliklari, eslatmalar...)</span>
        <textarea
          disabled={!canEdit}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input min-h-20"
        />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {canEdit && (
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      )}
    </form>
  );
}

function AdjustPointsForm({
  guestId,
  onCancel,
  onAdjusted,
}: {
  guestId: string;
  onCancel: () => void;
  onAdjusted: () => void;
}) {
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pointsNum = Number(points);
    if (!pointsNum) {
      setError("Ball miqdori 0 bo'lishi mumkin emas");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/guests/${guestId}/loyalty/adjust`, {
        method: 'POST',
        body: JSON.stringify({ points: pointsNum, reason }),
      });
      onAdjusted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <input
          required
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="masalan -20 yoki 50"
          className="input"
        />
        <input
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Sabab (masalan: kompensatsiya)"
          className="input"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Saqlanmoqda...' : 'Tasdiqlash'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
