import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { AlertModal } from '../components/AlertModal';
import { CountryPicker } from '../components/CountryPicker';
import { CreateProfileModal } from '../components/CreateProfileModal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { countryName } from '../lib/countries';
import {
  PROFILE_TYPES,
  isOrganizationType,
  profileTypeMeta,
} from '../lib/profile-types';
import type {
  BookingDto,
  CommunicationPreference,
  GuestDto,
  LoyaltyTier,
  LoyaltyTransactionDto,
  ProfileType,
} from '../lib/types';

const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  platinum: 'Platina',
};

const COMMUNICATION_LABELS: Record<CommunicationPreference, string> = {
  email: 'Email',
  sms: 'SMS',
  phone: 'Qo\'ng\'iroq',
  none: "Aloqa kerak emas",
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

// Qidiruv bo'limining yig'ish strelkasi (mahalliy — AppLayout'dagisi
// eksport qilinmagan va uning `open` propi bor, bu yerda esa burilish
// `group-open:` orqali CSS bilan boshqariladi).
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l6 6 6-6" />
    </svg>
  );
}

export function GuestsPage() {
  const { can } = useAuth();
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Qidiruv maydonlari (2026-09-04, OPERA Cloud "Manage Profile" referensi).
  // OPERA'da ~25 ta maydon bor; bu yerda bazamizda mavjud va reception kunda
  // ishlatadigan TO'RTTASI olindi (foydalanuvchi qarori).
  const [name, setName] = useState('');
  const [communication, setCommunication] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [nationality, setNationality] = useState('');
  // Bo'sh satr = "Barchasi". Standarti ataylab shu: sahifa nomi
  // "Profillarni boshqarish" — kirganda hamma tur ko'rinishi kerak.
  const [profileType, setProfileType] = useState<ProfileType | ''>('');

  const load = async (f: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(f).filter(([, v]) => v.trim() !== ''),
      ).toString();
      setGuests(await apiFetch<GuestDto[]>(qs ? `/guests?${qs}` : '/guests'));
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

  // ANIQ qidiruv (2026-09-04, foydalanuvchi qarori): avval maydon o'zgarishi
  // bilan 300ms kutib avtomatik qidirardi. Endi OPERA'dagidek "Qidirish" va
  // "Reset" tugmalari bor — foydalanuvchi to'rttala maydonni to'ldirib bo'lib
  // bir marta so'rov yuboradi, har harfga bittadan emas.
  //
  // `qollanilgan` — maydonlardagi matn EMAS, oxirgi marta HAQIQATAN yuborilgan
  // filtr. Modal yopilgandan keyin ro'yxatni shu bilan yangilaymiz: aks holda
  // foydalanuvchi maydonga yozib qo'yib "Qidirish"ni bosmagan bo'lsa, ro'yxat
  // o'zi kutmagan filtr bilan qayta yuklanib ketardi.
  const [qollanilgan, setQollanilgan] = useState<Record<string, string>>({});

  // Bo'sh qidiruv ogohlantirishi (2026-09-04, foydalanuvchi qarori). Hech
  // narsa kiritmasdan "Qidirish" bosish texnik jihatdan butun ro'yxatni
  // qaytarardi — lekin foydalanuvchi buni "qidiruv ishlamadi" deb tushunardi.
  // Endi aniq aytiladi. (Butun ro'yxat kerak bo'lsa "Tozalash" bor.)
  const [ogohlantirish, setOgohlantirish] = useState<string | null>(null);

  const qidirish = (e: FormEvent) => {
    e.preventDefault();
    const f = { name, communication, documentNumber, nationality, profileType };
    // Profil turi ham MEZON hisoblanadi: faqat "Kompaniya" tanlab qidirish
    // to'liq ma'noli so'rov.
    if (Object.values(f).every((v) => v.trim() === '')) {
      setOgohlantirish('Qidirish uchun kamida bitta mezon kiriting');
      return;
    }
    setQollanilgan(f);
    load(f);
  };

  const reset = () => {
    setName('');
    setCommunication('');
    setDocumentNumber('');
    setNationality('');
    setProfileType('');
    setQollanilgan({});
    load();
  };

  const qaytaYuklash = () => load(qollanilgan);

  return (
    <AppLayout
      title="Profillarni boshqarish"
      help={
        <>
          <p className="font-semibold">Profillarni boshqarish nima?</p>
          <p>
            Profil — mehmonxona ish yuritadigan har bir shaxs yoki tashkilotning
            doimiy yozuvi. Olti xil turi bor:
          </p>
          <p>
            <b className="font-medium">Mehmon</b> — xonada turadigan jismoniy shaxs
            (hujjati, fuqaroligi, sodiqlik ballari bilan).{' '}
            <b className="font-medium">Kompaniya</b> — xodimlarini joylashtiradigan
            tashkilot. <b className="font-medium">Turagent</b> — bron olib keladigan
            agentlik (komissiya bilan). <b className="font-medium">Manba</b> — bronlar
            qayerdan kelayotgani. <b className="font-medium">Guruh</b> — bir nechta bron
            uchun umumiy nom. <b className="font-medium">Kontakt</b> — tashkilotdagi
            aniq odam.
          </p>
          <p>
            Bron qilinganda mehmon shu yerdan tanlanadi — ya&apos;ni bir odam necha
            marta kelsa ham, tarixi bitta profilda to&apos;planadi. Bronda faqat
            <b className="font-medium"> Mehmon</b> turidagi profillar taklif qilinadi.
          </p>
          <p>
            Yangi profil <b className="font-medium">&quot;Yaratish&quot;</b> tugmasi
            orqali ochiladi — avval turi tanlanadi, keyin shu turga mos forma
            chiqadi. Bir odam uchun xato bilan ikkita profil ochilgan bo&apos;lsa,
            o&apos;sha oynadagi &quot;Ikkilanmalarni birlashtirish&quot; yordam beradi.
          </p>
        </>
      }
      // "Yaratish" endi ostiga ochiladigan ro'yxat emas, oyna ochadi
      // (2026-09-04, OPERA Cloud "I Want To..." referensi): profil turlari
      // olti xil bo'lgani uchun kichkina ro'yxat ularni tushuntira olmasdi.
      onActionsClick={() => setShowCreate(true)}
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {/* Qidiruv bo'limi (2026-09-04, OPERA Cloud "Manage Profile" referensi).
          OPERA'da ~25 ta maydon bor — bu yerda bazamizda mavjud va kunda
          ishlatiladigan to'rttasi. Yig'iladigan qilib qo'yilgan: qidiruv
          tugagach ro'yxatga joy bo'shatadi. */}
      <details open className="group mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="panel-header flex cursor-pointer list-none items-center justify-between">
          Qidirish
          <span className="text-brand-navy transition-transform group-open:rotate-180" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </summary>
        <form onSubmit={qidirish} className="border-t border-slate-100 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Ism</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Familiya yoki ism" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Aloqa</span>
              <input
                value={communication}
                onChange={(e) => setCommunication(e.target.value)}
                className="input"
                placeholder="Telefon yoki email"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Hujjat raqami</span>
              <input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="input"
                placeholder="Pasport / ID"
              />
            </label>
            <div className="block">
              <span className="mb-1 block text-xs text-slate-900">Fuqarolik</span>
              <CountryPicker value={nationality} onChange={setNationality} />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Profil turi</span>
              <select
                value={profileType}
                onChange={(e) => setProfileType(e.target.value as ProfileType | '')}
                className="input"
              >
                <option value="">Barchasi</option>
                {PROFILE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.shortLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Tugmalar HAR DOIM ko'rinadi (faqat filtr bor paytda emas):
              foydalanuvchi qidiruvni qayerda tugatishini bilib turishi kerak.
              `type="submit"` — Enter bosilganda ham ishlaydi. */}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={reset} className="btn-secondary">
              Tozalash
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Qidirilmoqda...' : 'Qidirish'}
            </button>
          </div>
        </form>
      </details>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {!loading && guests.length === 0 && <p className="p-4 text-sm text-slate-500">Profil topilmadi</p>}
        {guests.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGuestId(g.id)}
            className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900 flex items-center gap-2">
                {g.fullName}
                {/* Sodiqlik darajasi faqat jismoniy mehmonda ma'noli —
                    kompaniyaning "Bronza" bo'lishi mantiqsiz. */}
                {g.profileType === 'guest' ? (
                  <TierBadge tier={g.loyaltyTier} />
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {profileTypeMeta(g.profileType).shortLabel}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[g.phone, g.email, countryName(g.nationality), g.taxId && `STIR ${g.taxId}`]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </div>
            {g.profileType === 'guest' && (
              <p className="text-xs text-slate-500 shrink-0">{g.loyaltyPoints} ball</p>
            )}
          </button>
        ))}
      </div>

      {ogohlantirish && (
        <AlertModal message={ogohlantirish} onClose={() => setOgohlantirish(null)} />
      )}

      {showCreate && (
        <CreateProfileModal
          canCreate={can('guest_crm', 'create')}
          canMerge={can('guest_crm', 'delete')}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qaytaYuklash();
          }}
          onMergeDuplicates={() => {
            setShowCreate(false);
            setShowDuplicates(true);
          }}
        />
      )}

      {selectedGuestId && (
        <GuestDetailModal
          guestId={selectedGuestId}
          onClose={() => setSelectedGuestId(null)}
          onChanged={() => qaytaYuklash()}
        />
      )}

      {showDuplicates && (
        <DuplicatesModal
          onClose={() => setShowDuplicates(false)}
          onMerged={() => qaytaYuklash()}
        />
      )}
    </AppLayout>
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

  // Sodiqlik faqat jismoniy mehmonda bo'ladi — kompaniya/turagent profilida
  // "Loyalty" tabi ham, ball satri ham ko'rsatilmaydi (2026-09-04).
  const isGuestProfile = guest?.profileType === 'guest';

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'profile', label: 'Profil' },
    ...(isGuestProfile
      ? [{ key: 'loyalty' as DetailTab, label: 'Loyalty' }]
      : []),
    { key: 'stays', label: 'Turgan kunlari' },
  ];

  return (
    <Modal title={guest ? guest.fullName : 'Profil'} onClose={onClose} width="max-w-2xl">
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {loading || !guest ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {isGuestProfile ? (
              <>
                <TierBadge tier={guest.loyaltyTier} />
                <span className="text-sm text-slate-600">
                  {guest.loyaltyPoints} ball (jami to'plangan: {guest.lifetimePoints})
                </span>
              </>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                {profileTypeMeta(guest.profileType).shortLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  tab === t.key
                    ? 'chip-active'
                    : 'bg-white border border-slate-200 text-brand-navy hover:bg-slate-100'
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
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
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
  const [roomPreference, setRoomPreference] = useState(guest.roomPreference ?? '');
  const [dietaryPreference, setDietaryPreference] = useState(guest.dietaryPreference ?? '');
  const [communicationPreference, setCommunicationPreference] = useState<CommunicationPreference>(
    guest.communicationPreference,
  );
  const [taxId, setTaxId] = useState(guest.taxId ?? '');
  const [address, setAddress] = useState(guest.address ?? '');
  const [city, setCity] = useState(guest.city ?? '');
  const [contactPerson, setContactPerson] = useState(guest.contactPerson ?? '');
  const [commissionPct, setCommissionPct] = useState(guest.commissionPct ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Qaysi maydonlar ko'rsatilishi profil turiga bog'liq — server ham aynan
  // shunday cheklaydi, ya'ni yashirilgan maydonni yuborish 400 qaytaradi.
  const isGuest = guest.profileType === 'guest';
  const isOrg = isOrganizationType(guest.profileType);
  const hasContactPerson = isOrg || guest.profileType === 'group';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
        communicationPreference,
      };
      if (isGuest) {
        body.nationality = nationality || undefined;
        body.dateOfBirth = dateOfBirth || undefined;
        body.roomPreference = roomPreference || undefined;
        body.dietaryPreference = dietaryPreference || undefined;
      }
      if (isOrg) {
        body.taxId = taxId || undefined;
        body.address = address || undefined;
        body.city = city || undefined;
      }
      if (hasContactPerson) body.contactPerson = contactPerson || undefined;
      if (guest.profileType === 'travel_agent' && commissionPct.trim() !== '') {
        body.commissionPct = Number(commissionPct);
      }
      await apiFetch(`/guests/${guest.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
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
        {isGuest && (
          <>
            <div className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Fuqarolik</span>
              <CountryPicker
                value={nationality}
                onChange={setNationality}
                disabled={!canEdit}
              />
            </div>
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
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Xona afzalligi</span>
              <input
                disabled={!canEdit}
                value={roomPreference}
                onChange={(e) => setRoomPreference(e.target.value)}
                className="input"
                placeholder="masalan: Yuqori qavat, tinch xona"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Parhez/allergiya</span>
              <input
                disabled={!canEdit}
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value)}
                className="input"
                placeholder="masalan: Vegetarian, yong'oqqa allergiya"
              />
            </label>
          </>
        )}
        {isOrg && (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">STIR</span>
              <input
                disabled={!canEdit}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Shahar</span>
              <input
                disabled={!canEdit}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Manzil</span>
              <input
                disabled={!canEdit}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
              />
            </label>
          </>
        )}
        {hasContactPerson && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa shaxsi</span>
            <input
              disabled={!canEdit}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input"
            />
          </label>
        )}
        {guest.profileType === 'travel_agent' && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Komissiya (%)</span>
            <input
              disabled={!canEdit}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              className="input"
            />
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa afzalligi</span>
          <select
            disabled={!canEdit}
            value={communicationPreference}
            onChange={(e) => setCommunicationPreference(e.target.value as CommunicationPreference)}
            className="input"
          >
            {Object.entries(COMMUNICATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (eslatmalar, VIP maqomi...)</span>
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
    <form onSubmit={submit} className="bg-slate-50 rounded-2xl p-3 space-y-2 border border-slate-200">
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

function DuplicatesModal({ onClose, onMerged }: { onClose: () => void; onMerged: () => void }) {
  const [groups, setGroups] = useState<GuestDto[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergingGroupIndex, setMergingGroupIndex] = useState<number | null>(null);
  // Har bir guruh uchun tanlangan "asosiy" mehmon ID'si (boshqalari shu ID'ga birlashtiriladi).
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<GuestDto[][]>('/guests/duplicates');
      setGroups(data);
      const defaults: Record<number, string> = {};
      data.forEach((group, i) => {
        defaults[i] = group[0].id;
      });
      setPrimaryByGroup(defaults);
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

  const merge = async (groupIndex: number) => {
    const group = groups[groupIndex];
    const primaryId = primaryByGroup[groupIndex];
    if (!primaryId) return;
    setMergingGroupIndex(groupIndex);
    setError(null);
    try {
      // Guruhdagi qolgan barcha mehmonlarni birma-bir asosiy mehmonga birlashtiradi.
      for (const g of group) {
        if (g.id === primaryId) continue;
        await apiFetch(`/guests/${primaryId}/merge`, {
          method: 'POST',
          body: JSON.stringify({ duplicateGuestId: g.id }),
        });
      }
      onMerged();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Birlashtirishda xatolik yuz berdi');
    } finally {
      setMergingGroupIndex(null);
    }
  };

  return (
    <Modal title="Ehtimoliy ikkilanmalar" onClose={onClose} width="max-w-2xl">
      <p className="text-sm text-slate-500 mb-4">
        Bir xil telefon, email yoki hujjat raqamiga ega mehmonlar shu yerda guruhlangan. Har bir
        guruhda "asosiy" mehmonni tanlang — qolganlarining bronlari, hisob-fakturalari va loyalty
        ballari shunga ko'chiriladi, so'ng ular o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
      </p>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">Ikkilanma mehmonlar topilmadi.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl p-3">
              <div className="space-y-2 mb-3">
                {group.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`primary-${i}`}
                      checked={primaryByGroup[i] === g.id}
                      onChange={() => setPrimaryByGroup((prev) => ({ ...prev, [i]: g.id }))}
                    />
                    <span className="font-medium text-slate-900">{g.fullName}</span>
                    <span className="text-xs text-slate-500">
                      {[g.phone, g.email, g.documentNumber].filter(Boolean).join(' · ') || '—'}
                    </span>
                    <span className="text-xs text-slate-400">({g.loyaltyPoints} ball)</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => merge(i)}
                disabled={mergingGroupIndex === i}
                className="btn-primary text-sm"
              >
                {mergingGroupIndex === i ? 'Birlashtirilmoqda...' : "Tanlangan mehmonga birlashtirish"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
