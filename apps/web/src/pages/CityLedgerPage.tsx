import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { CityLedgerStatementDto, CorporateAccountDto } from '../lib/types';

export function CityLedgerPage() {
  const { property, can } = useAuth();
  const [accounts, setAccounts] = useState<CorporateAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAccount, setFormAccount] = useState<CorporateAccountDto | 'new' | null>(null);
  const [detailAccount, setDetailAccount] = useState<CorporateAccountDto | null>(null);

  const canCreate = can('invoicing', 'create');
  const canEdit = can('invoicing', 'edit') || canCreate;

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const list = await apiFetch<CorporateAccountDto[]>(`/properties/${property.id}/corporate-accounts`);
      setAccounts(list);
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
    <AppLayout title="City Ledger (Korporativ hisoblar)">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Mehmonxona bilan "kredit"da ishlaydigan kompaniyalar — mehmon check-out paytida o'zi to'lamaydi,
          hisob-faktura shu kompaniyaning hisob-varag'iga (statement) qo'shiladi.
        </p>
        {canCreate && (
          <button onClick={() => setFormAccount('new')} className="btn-primary shrink-0">
            + Yangi hisob
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-500">Hali korporativ hisob qo'shilmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nomi</th>
                <th className="text-left px-4 py-2">Aloqa</th>
                <th className="text-left px-4 py-2">To'lov muddati</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailAccount(a)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[a.contactName, a.contactPhone, a.contactEmail].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.paymentTermsDays} kun</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {a.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-navy underline">Hisob-varaq</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAccount && property && (
        <CorporateAccountFormModal
          propertyId={property.id}
          account={formAccount === 'new' ? null : formAccount}
          onClose={() => setFormAccount(null)}
          onSaved={() => {
            setFormAccount(null);
            load();
          }}
        />
      )}

      {detailAccount && property && (
        <CorporateAccountDetailModal
          propertyId={property.id}
          account={detailAccount}
          canEdit={canEdit}
          onClose={() => setDetailAccount(null)}
          onEdit={() => {
            setFormAccount(detailAccount);
            setDetailAccount(null);
          }}
        />
      )}
    </AppLayout>
  );
}

function CorporateAccountDetailModal({
  propertyId,
  account,
  canEdit,
  onClose,
  onEdit,
}: {
  propertyId: string;
  account: CorporateAccountDto;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [statement, setStatement] = useState<CityLedgerStatementDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CityLedgerStatementDto>(`/properties/${propertyId}/corporate-accounts/${account.id}/statement`)
      .then(setStatement)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Hisob-varaqni yuklashda xatolik"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, account.id]);

  return (
    <Modal title={account.name} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {account.taxId && <Row label="STIR" value={account.taxId} />}
          {account.contactName && <Row label="Aloqa shaxsi" value={account.contactName} />}
          {account.contactPhone && <Row label="Telefon" value={account.contactPhone} />}
          {account.contactEmail && <Row label="Email" value={account.contactEmail} />}
          {account.billingAddress && <Row label="Manzil" value={account.billingAddress} />}
          <Row label="To'lov muddati" value={`${account.paymentTermsDays} kun`} />
          {account.creditLimit && (
            <Row label="Kredit limiti" value={Number(account.creditLimit).toLocaleString('uz-UZ')} />
          )}
          <Row label="Holat" value={account.isActive ? 'Faol' : 'Nofaol'} />
          {account.notes && <Row label="Izoh" value={account.notes} />}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Hisob-varaq (Statement)</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!statement && !error && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
          {statement && (
            <>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <SummaryStat label="Hisob-fakturalar" value={String(statement.invoiceCount)} />
                <SummaryStat label="Jami hisoblangan" value={Number(statement.totalCharged).toLocaleString('uz-UZ')} />
                <SummaryStat label="Qoldiq" value={Number(statement.totalBalance).toLocaleString('uz-UZ')} />
                <SummaryStat
                  label="Muddati o'tgan"
                  value={Number(statement.overdueBalance).toLocaleString('uz-UZ')}
                  danger={Number(statement.overdueBalance) > 0}
                />
              </div>
              {statement.lines.length === 0 ? (
                <p className="text-sm text-slate-500">Hali hisob-faktura yo'q.</p>
              ) : (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-1.5">Mehmon</th>
                        <th className="text-left px-3 py-1.5">Holat</th>
                        <th className="text-right px-3 py-1.5">Summa</th>
                        <th className="text-right px-3 py-1.5">Qoldiq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.lines.map((line) => (
                        <tr key={line.invoiceId} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">{line.guestName}</td>
                          <td className="px-3 py-1.5">{line.status}</td>
                          <td className="px-3 py-1.5 text-right">{Number(line.totalAmount).toLocaleString('uz-UZ')}</td>
                          <td
                            className={`px-3 py-1.5 text-right font-medium ${
                              line.isOverdue ? 'text-rose-600' : 'text-slate-700'
                            }`}
                          >
                            {Number(line.balance).toLocaleString('uz-UZ')}
                            {line.isOverdue && ' ⚠'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Bekor qilingan hisob-fakturalar hisobga olinmaydi. Hech qanday avtomatik accounting provodkasi
            qilinmaydi — bu faqat real vaqtda hisoblangan hisob-varaq.
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

function CorporateAccountFormModal({
  propertyId,
  account,
  onClose,
  onSaved,
}: {
  propertyId: string;
  account: CorporateAccountDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = account !== null;
  const [name, setName] = useState(account?.name ?? '');
  const [taxId, setTaxId] = useState(account?.taxId ?? '');
  const [contactName, setContactName] = useState(account?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(account?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(account?.contactEmail ?? '');
  const [billingAddress, setBillingAddress] = useState(account?.billingAddress ?? '');
  const [creditLimit, setCreditLimit] = useState(account?.creditLimit ?? '');
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(account?.paymentTermsDays ?? 30));
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name,
        taxId: taxId || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        billingAddress: billingAddress || undefined,
        creditLimit: creditLimit || undefined,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : undefined,
        notes: notes || undefined,
        ...(isEdit ? { isActive } : {}),
      };
      if (isEdit) {
        await apiFetch(`/properties/${propertyId}/corporate-accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/properties/${propertyId}/corporate-accounts`, {
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
    <Modal title={isEdit ? 'Korporativ hisobni tahrirlash' : 'Yangi korporativ hisob'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Kompaniya nomi</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">STIR (ixtiyoriy)</span>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Aloqa shaxsi</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" />
          </label>
        </div>
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
          <span className="block text-xs font-medium text-slate-600 mb-1">Manzil (ixtiyoriy)</span>
          <input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Kredit limiti (ixtiyoriy)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">To'lov muddati (kun)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              className="input"
            />
          </label>
        </div>
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
          {submitting ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Hisob yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function SummaryStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-md p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
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
