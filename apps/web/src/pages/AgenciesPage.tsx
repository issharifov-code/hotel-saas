import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { ProfilePicker } from '../components/ProfilePicker';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  AgencyCommissionDto,
  AgencyDto,
  AgencyPaymentMethod,
  AgencySummaryDto,
} from '../lib/types';

export function AgenciesPage() {
  const { property, can } = useAuth();
  const [agencies, setAgencies] = useState<AgencyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAgency, setFormAgency] = useState<AgencyDto | 'new' | null>(null);
  const [detailAgency, setDetailAgency] = useState<AgencyDto | null>(null);

  const canCreate = can('booking', 'create');
  const canEdit = can('booking', 'edit') || canCreate;
  // To'lov — moliyaviy provodka, shuning uchun buxgalteriya huquqi kerak
  // (agentlik kartochkasini tahrirlash huquqi yetarli emas).
  const canPay = can('accounting', 'approve');

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const list = await apiFetch<AgencyDto[]>(`/properties/${property.id}/agencies`);
      setAgencies(list);
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

  return (
    <AppLayout title="Turizm agentliklari">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Mehmonxonaga muntazam mehmon yo'naltiradigan turizm agentliklari va korporativ hamkorlar hamda ular
          uchun komissiya foizini shu yerda boshqaring.
        </p>
        {canCreate && (
          <button onClick={() => setFormAgency('new')} className="btn-primary shrink-0">
            + Yangi agentlik
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : agencies.length === 0 ? (
        <p className="text-sm text-slate-500">Hali agentlik qo'shilmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nomi</th>
                <th className="text-left px-4 py-2">Aloqa</th>
                <th className="text-left px-4 py-2">Komissiya</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailAgency(a)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[a.contactName, a.contactPhone, a.contactEmail].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{Number(a.commissionPct)}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {a.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-navy underline">Batafsil</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAgency && property && (
        <AgencyFormModal
          propertyId={property.id}
          agency={formAgency === 'new' ? null : formAgency}
          onClose={() => setFormAgency(null)}
          onSaved={() => {
            setFormAgency(null);
            load();
          }}
        />
      )}

      {detailAgency && property && (
        <AgencyDetailModal
          propertyId={property.id}
          agency={detailAgency}
          canEdit={canEdit}
          canPay={canPay}
          onClose={() => setDetailAgency(null)}
          onEdit={() => {
            setFormAgency(detailAgency);
            setDetailAgency(null);
          }}
        />
      )}
    </AppLayout>
  );
}

function AgencyDetailModal({
  propertyId,
  agency,
  canEdit,
  canPay,
  onClose,
  onEdit,
}: {
  propertyId: string;
  agency: AgencyDto;
  canEdit: boolean;
  canPay: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [summary, setSummary] = useState<AgencySummaryDto | null>(null);
  const [commissions, setCommissions] = useState<AgencyCommissionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = () => {
    Promise.all([
      apiFetch<AgencySummaryDto>(`/properties/${propertyId}/agencies/${agency.id}/summary`),
      apiFetch<AgencyCommissionDto[]>(
        `/properties/${propertyId}/agencies/${agency.id}/commissions`,
      ),
    ])
      .then(([s, list]) => {
        setSummary(s);
        setCommissions(list);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Hisobotni yuklashda xatolik'));
  };

  useEffect(load, [propertyId, agency.id]);

  const unpaid = commissions.filter((c) => c.status === 'accrued');

  return (
    <Modal title={agency.name} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {agency.contactName && <Row label="Aloqa shaxsi" value={agency.contactName} />}
          {agency.contactPhone && <Row label="Telefon" value={agency.contactPhone} />}
          {agency.contactEmail && <Row label="Email" value={agency.contactEmail} />}
          <Row label="Komissiya" value={`${Number(agency.commissionPct)}%`} />
          <Row label="Holat" value={agency.isActive ? 'Faol' : 'Nofaol'} />
          {agency.notes && <Row label="Izoh" value={agency.notes} />}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Komissiya hisob-kitobi</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!summary && !error && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
          {summary && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <SummaryStat label="Hisoblangan" value={money(summary.accruedAmount, summary.currency)} />
                <SummaryStat label="To'langan" value={money(summary.paidAmount, summary.currency)} />
                {/* Qarz — bosh kitobdagi 2010 hisobining qoldig'i bilan bir xil. */}
                <SummaryStat
                  label="Qarz"
                  value={money(summary.outstandingAmount, summary.currency)}
                  accent={Number(summary.outstandingAmount) > 0}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <SummaryStat
                  label={`Kutilmoqda (${summary.projectedBookingCount} bron)`}
                  value={money(summary.projectedAmount, summary.currency)}
                  muted
                />
                {summary.historicalBookingCount > 0 && (
                  <SummaryStat
                    label={`Yozuvdan oldingi (${summary.historicalBookingCount} bron, taxminiy)`}
                    value={money(summary.historicalEstimate, summary.currency)}
                    muted
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Komissiya mehmon <b className="font-medium">check-out</b> qilinganda hisoblanadi va
                o'sha zahoti bosh kitobga yoziladi. Bekor qilingan va kelmagan (no-show) bronlar
                hisobga olinmaydi. Foizni o'zgartirish faqat keyingi bronlarga ta'sir qiladi.
              </p>
            </>
          )}
        </div>

        {commissions.length > 0 && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Chiqish sanasi</th>
                  <th className="px-3 py-2 text-right font-medium">Xona narxi</th>
                  <th className="px-3 py-2 text-right font-medium">Foiz</th>
                  <th className="px-3 py-2 text-right font-medium">Komissiya</th>
                  <th className="px-3 py-2 text-left font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.accruedOn}</td>
                    <td className="px-3 py-2 text-right">{money(c.baseAmount)}</td>
                    <td className="px-3 py-2 text-right">{Number(c.commissionPct)}%</td>
                    <td className="px-3 py-2 text-right font-medium">{money(c.amount)}</td>
                    <td className="px-3 py-2">
                      {c.status === 'paid' ? (
                        <span className="text-emerald-700">To'langan</span>
                      ) : (
                        <span className="text-amber-700">To'lanmagan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2">
          {canPay && unpaid.length > 0 && (
            <button onClick={() => setPaying(true)} className="btn-primary flex-1">
              To'lash ({unpaid.length} ta)
            </button>
          )}
          {canEdit && (
            <button onClick={onEdit} className="btn-secondary flex-1">
              Tahrirlash
            </button>
          )}
        </div>
      </div>

      {paying && summary && (
        <PayCommissionsModal
          propertyId={propertyId}
          agency={agency}
          count={unpaid.length}
          total={summary.outstandingAmount}
          currency={summary.currency}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            load();
          }}
        />
      )}
    </Modal>
  );
}

// Agentlikka to'lov — to'lanmagan komissiyalarning HAMMASINI yopadi.
// Qisman to'lov hozircha yo'q: amalda mehmonxona agentlik bilan davr
// bo'yicha to'liq hisob-kitob qiladi, va "qaysi bronni to'ladim" degan
// tanlov oynani keraksiz murakkablashtirardi. Kerak bo'lsa backend
// allaqachon `commissionIds` ni qabul qiladi.
function PayCommissionsModal({
  propertyId,
  agency,
  count,
  total,
  currency,
  onClose,
  onPaid,
}: {
  propertyId: string;
  agency: AgencyDto;
  count: number;
  total: string;
  currency: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<AgencyPaymentMethod>('bank_transfer');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/agencies/${agency.id}/commission-payments`, {
        method: 'POST',
        body: JSON.stringify({ method, paidOn, reference: reference || undefined }),
      });
      onPaid();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Komissiyani to'lash" onClose={onClose} compact>
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <b className="font-medium">{agency.name}</b> uchun {count} ta to'lanmagan komissiya —
          jami <b className="font-medium">{money(total, currency)}</b>.
        </p>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To'lov usuli</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as AgencyPaymentMethod)}
            className="input"
          >
            <option value="bank_transfer">Bank o'tkazmasi</option>
            <option value="cash">Naqd</option>
            <option value="card">Karta</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To'lov sanasi</span>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            To'lov topshirig'i raqami (ixtiyoriy)
          </span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <p className="text-xs text-slate-500">
          Tasdiqlangach bosh kitobga provodka yoziladi: agentlik qarzi kamayadi, tanlangan
          kassa/bank hisobi kamayadi. Yozuvni o'chirib bo'lmaydi — faqat teskari provodka bilan
          tuzatiladi.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Yozilmoqda...' : "To'lovni tasdiqlash"}
        </button>
      </form>
    </Modal>
  );
}

function AgencyFormModal({
  propertyId,
  agency,
  onClose,
  onSaved,
}: {
  propertyId: string;
  agency: AgencyDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = agency !== null;
  const [name, setName] = useState(agency?.name ?? '');
  const [contactName, setContactName] = useState(agency?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(agency?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(agency?.contactEmail ?? '');
  const [commissionPct, setCommissionPct] = useState(agency?.commissionPct ?? '10');
  const [notes, setNotes] = useState(agency?.notes ?? '');
  const [isActive, setIsActive] = useState(agency?.isActive ?? true);
  // Mavjud TURAGENT profilini ulash (2026-09-04). Tanlangan bo'lsa, nom va
  // aloqa maydonlari profildan to'ldiriladi va bloklanadi — ular profilning
  // ma'lumoti, bu yerda emas. Tanlanmasa, eskicha: yozilgan nomdan yangi
  // profil ochiladi.
  const [profileId, setProfileId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        commissionPct: commissionPct || undefined,
        notes: notes || undefined,
        // Faqat YARATISHDA: mavjud profil tanlangan bo'lsa uni ulaydi.
        // Tahrirlashda profil allaqachon bog'langan va o'zgartirilmaydi.
        ...(!isEdit && profileId ? { profileId } : {}),
        ...(isEdit ? { isActive } : {}),
      };
      if (isEdit) {
        await apiFetch(`/properties/${propertyId}/agencies/${agency.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/properties/${propertyId}/agencies`, {
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
    <Modal title={isEdit ? 'Agentlikni tahrirlash' : 'Yangi agentlik'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {/* Yaratishda: avval mavjud profildan tanlash taklif qilinadi.
            Aynan shu takrorlanishni yo'q qiladi — "Silk Road Tours" profil
            sifatida bor bo'lsa, uni qayta yozish shart emas. */}
        {!isEdit && (
          <ProfilePicker
            type="travel_agent"
            value={profileId}
            onChange={setProfileId}
            onPick={(p) => {
              // Tanlangan profil ma'lumotlari formaga tushadi (va bloklanadi).
              // Bekor qilinsa — maydonlar bo'shatiladi, chunki ular endi
              // yangi profil uchun kiritiladi.
              setName(p?.fullName ?? '');
              setContactName(p?.contactPerson ?? '');
              setContactPhone(p?.phone ?? '');
              setContactEmail(p?.email ?? '');
            }}
            label="Mavjud turagent profili"
            noneLabel="— Yangi profil ochish —"
            hint="Tanlansa nom va aloqa profildan olinadi"
          />
        )}
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input
            required
            disabled={!isEdit && profileId !== ''}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa shaxsi</span>
          <input
            disabled={!isEdit && profileId !== ''}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
            <input
              disabled={!isEdit && profileId !== ''}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="input"
              placeholder="+998..."
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
            <input
              type="email"
              disabled={!isEdit && profileId !== ''}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Komissiya foizi (%)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            className="input"
          />
          {isEdit && (
            <span className="mt-1 block text-[11px] text-slate-500">
              O'zgartirish faqat KEYINGI check-out'larga ta'sir qiladi — allaqachon
              hisoblangan komissiyalar o'z foizini saqlab qoladi.
            </span>
          )}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Faol
          </label>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Agentlik yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function money(value: string, currency?: string): string {
  const n = Number(value).toLocaleString('uz-UZ');
  return currency ? `${n} ${currency}` : n;
}

function SummaryStat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  // Qarz noldan katta bo'lsa ko'zga tashlanadi — bu harakat talab qiladigan
  // yagona raqam.
  accent?: boolean;
  // Prognoz/taxmin — bosh kitobda yozuvi yo'q, shuning uchun so'nikroq.
  muted?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-3 ${accent ? 'bg-amber-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-sm font-semibold mt-0.5 ${
          accent ? 'text-amber-800' : muted ? 'text-slate-500' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-900">{value}</p>
    </div>
  );
}
