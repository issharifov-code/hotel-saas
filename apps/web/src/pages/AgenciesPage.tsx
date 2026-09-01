import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { AgencyDto, AgencySummaryDto } from '../lib/types';

export function AgenciesPage() {
  const { property, can } = useAuth();
  const [agencies, setAgencies] = useState<AgencyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAgency, setFormAgency] = useState<AgencyDto | 'new' | null>(null);
  const [detailAgency, setDetailAgency] = useState<AgencyDto | null>(null);

  const canCreate = can('booking', 'create');
  const canEdit = can('booking', 'edit') || canCreate;

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
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
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
  onClose,
  onEdit,
}: {
  propertyId: string;
  agency: AgencyDto;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [summary, setSummary] = useState<AgencySummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AgencySummaryDto>(`/properties/${propertyId}/agencies/${agency.id}/summary`)
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Hisobotni yuklashda xatolik"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, agency.id]);

  return (
    <Modal title={agency.name} onClose={onClose} width="max-w-lg">
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
          <p className="text-xs font-medium text-slate-600 mb-2">Bronlar bo'yicha hisobot</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!summary && !error && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
          {summary && (
            <div className="grid grid-cols-3 gap-3">
              <SummaryStat label="Bronlar soni" value={String(summary.bookingCount)} />
              <SummaryStat label="Jami summa" value={Number(summary.totalRevenue).toLocaleString('uz-UZ')} />
              <SummaryStat label="Komissiya" value={Number(summary.commissionOwed).toLocaleString('uz-UZ')} />
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Bekor qilingan bronlar hisobga olinmaydi. Komissiya faqat hisobot maqsadida hisoblanadi — moliyaviy
            provodka sifatida yozilmaydi.
          </p>
        </div>

        {canEdit && (
          <button onClick={onEdit} className="btn-secondary w-full">
            Tahrirlash
          </button>
        )}
      </div>
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
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa shaxsi</span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
            <input
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-md p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
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
