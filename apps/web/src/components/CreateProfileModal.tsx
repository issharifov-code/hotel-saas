import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { CountryPicker } from './CountryPicker';
import { apiFetch, ApiError } from '../lib/api';
import type { GuestDto, ProfileType } from '../lib/types';
import {
  PROFILE_TYPES,
  isOrganizationType,
  profileTypeMeta,
} from '../lib/profile-types';

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="10" cy="10" r="8" />
      <path strokeLinecap="round" d="M10 6.5v7M6.5 10h7" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.5 3a4 4 0 00-3.7 5.5L3 14.3V17h2.7l5.8-5.8A4 4 0 1012.5 3z"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-6 6 6 6" />
    </svg>
  );
}

// "Yaratish" oynasi (2026-09-04, OPERA Cloud "I Want To..." referensi).
//
// Ikki bosqich, BITTA oynada: avval profil TURI tanlanadi, keyin shu turga mos
// forma ochiladi. Turlar ro'yxati bilan forma alohida oyna qilinmadi — orqaga
// qaytish ("boshqa tur ekan") bir bosishda bo'lishi kerak.
export function CreateProfileModal({
  onClose,
  onCreated,
  onMergeDuplicates,
  canCreate,
  canMerge,
}: {
  onClose: () => void;
  onCreated: (guest: GuestDto) => void;
  onMergeDuplicates: () => void;
  canCreate: boolean;
  canMerge: boolean;
}) {
  const [type, setType] = useState<ProfileType | null>(null);

  if (type) {
    return (
      <CreateProfileForm
        type={type}
        onBack={() => setType(null)}
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  }

  return (
    <Modal title="Parametrlar" onClose={onClose} width="max-w-2xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm text-slate-900">
            <span className="text-slate-400">
              <PlusIcon />
            </span>
            Profil yaratish
          </p>
          <div className="space-y-0.5">
            {PROFILE_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={!canCreate}
                onClick={() => setType(t.key)}
                className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-navy-light disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="block text-sm text-brand-navy">{t.label}</span>
                {/* Tushuntirish shart: "Manba" va "Guruh" nima ekani
                    nomidan tushunarli emas. */}
                <span className="block text-[11px] text-slate-500">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-6">
          <p className="mb-2 flex items-center gap-2 text-sm text-slate-900">
            <span className="text-slate-400">
              <WrenchIcon />
            </span>
            Amallar
          </p>
          <div className="space-y-0.5">
            <button
              type="button"
              disabled={!canMerge}
              onClick={onMergeDuplicates}
              className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-navy-light disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span className="block text-sm text-brand-navy">
                Dublikat profillarni birlashtirish
              </span>
              <span className="block text-[11px] text-slate-500">
                Bir odam uchun xato bilan ochilgan ikkita profil
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateProfileForm({
  type,
  onBack,
  onClose,
  onCreated,
}: {
  type: ProfileType;
  onBack: () => void;
  onClose: () => void;
  onCreated: (guest: GuestDto) => void;
}) {
  const meta = profileTypeMeta(type);
  const isOrg = isOrganizationType(type);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  const [parentProfileId, setParentProfileId] = useState('');
  const [organizations, setOrganizations] = useState<GuestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Kontakt profili tashkilotga bog'lanadi — ro'yxatni faqat shu holatda
  // yuklaymiz (boshqa turlarda keraksiz so'rov bo'lardi).
  useEffect(() => {
    if (type !== 'contact') return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        ['company', 'travel_agent', 'source'].map((t) =>
          apiFetch<GuestDto[]>(`/guests?profileType=${t}`).catch(() => []),
        ),
      );
      if (!cancelled) setOrganizations(results.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // FAQAT shu turga tegishli maydonlar yuboriladi. Bo'sh satrni ham
      // yubormaymiz — server "bu maydon bu turda ishlatilmaydi" deb xato
      // qaytarishi mumkin.
      const body: Record<string, unknown> = {
        profileType: type,
        fullName,
        phone: phone || undefined,
        email: email || undefined,
      };
      if (type === 'guest') {
        body.nationality = nationality || undefined;
        body.documentNumber = documentNumber || undefined;
      }
      if (isOrg) {
        body.taxId = taxId || undefined;
        body.address = address || undefined;
        body.city = city || undefined;
      }
      if (isOrg || type === 'group') {
        body.contactPerson = contactPerson || undefined;
      }
      if (type === 'travel_agent' && commissionPct.trim() !== '') {
        body.commissionPct = Number(commissionPct);
      }
      if (type === 'contact' && parentProfileId) {
        body.parentProfileId = parentProfileId;
      }
      const created = await apiFetch<GuestDto>('/guests', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={meta.label} onClose={onClose} width="max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-brand-navy hover:underline"
      >
        <BackIcon />
        Boshqa tur tanlash
      </button>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-900">{meta.nameLabel}</span>
          <input
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-900">Telefon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+998..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-900">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </label>
        </div>

        {type === 'guest' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs text-slate-900">Fuqarolik</span>
              <CountryPicker value={nationality} onChange={setNationality} />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Hujjat raqami</span>
              <input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="input"
                placeholder="Pasport / ID"
              />
            </label>
          </div>
        )}

        {isOrg && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-900">STIR</span>
                <input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="input"
                  placeholder="Soliq to'lovchi raqami"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-900">Shahar</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="input" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-900">Manzil</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
              />
            </label>
          </>
        )}

        {(isOrg || type === 'group') && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-900">Aloqa shaxsi</span>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input"
              placeholder="Kim bilan gaplashiladi"
            />
          </label>
        )}

        {type === 'travel_agent' && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-900">Komissiya (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              className="input"
              placeholder="masalan: 12.5"
            />
          </label>
        )}

        {type === 'contact' && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-900">Tashkilot</span>
            <select
              value={parentProfileId}
              onChange={(e) => setParentProfileId(e.target.value)}
              className="input"
            >
              <option value="">— tanlanmagan —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName} ({profileTypeMeta(o.profileType).shortLabel})
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}
