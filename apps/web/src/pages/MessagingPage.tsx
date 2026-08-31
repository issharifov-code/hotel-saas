import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  GuestDto,
  MessageChannel,
  MessageLogDto,
  MessageTemplateDto,
  MessageTriggerType,
} from '../lib/types';

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  email: 'Email',
  sms: 'SMS',
};

const TRIGGER_LABELS: Record<MessageTriggerType, string> = {
  booking_confirmed: 'Bron tasdiqlandi',
  checked_in: 'Check-in qilindi',
  checked_out: 'Check-out qilindi',
  custom: 'Erkin (qo\'lda)',
};

const STATUS_COLORS: Record<'sent' | 'failed', string> = {
  sent: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
};

const STATUS_LABELS: Record<'sent' | 'failed', string> = {
  sent: 'Yuborildi',
  failed: 'Muvaffaqiyatsiz',
};

type Tab = 'logs' | 'templates';

export function MessagingPage() {
  const { property, can } = useAuth();
  const [tab, setTab] = useState<Tab>('logs');
  const [templates, setTemplates] = useState<MessageTemplateDto[]>([]);
  const [logs, setLogs] = useState<MessageLogDto[]>([]);
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const canCreate = can('guest_crm', 'create');
  const canEdit = can('guest_crm', 'edit');

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const [templateList, logList, guestList] = await Promise.all([
        apiFetch<MessageTemplateDto[]>(`/properties/${property.id}/message-templates`),
        apiFetch<MessageLogDto[]>(`/properties/${property.id}/message-logs`),
        apiFetch<GuestDto[]>('/guests'),
      ]);
      setTemplates(templateList);
      setLogs(logList);
      setGuests(guestList);
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
    <AppLayout title="Xabarlar">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('logs')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'logs' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Xabarlar tarixi
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'templates' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Shablonlar
          </button>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            {tab === 'templates' && (
              <button onClick={() => setCreateTemplateOpen(true)} className="btn-primary shrink-0">
                + Yangi shablon
              </button>
            )}
            {tab === 'logs' && (
              <button onClick={() => setSendOpen(true)} className="btn-primary shrink-0" disabled={guests.length === 0}>
                + Yangi xabar
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : tab === 'logs' ? (
        logs.length === 0 ? (
          <p className="text-sm text-slate-500">Hali xabar yuborilmagan.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Mehmon</th>
                  <th className="text-left px-4 py-2">Kanal</th>
                  <th className="text-left px-4 py-2">Mavzu / matn</th>
                  <th className="text-left px-4 py-2">Holat</th>
                  <th className="text-left px-4 py-2">Yuborilgan vaqti</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{l.guest?.fullName ?? l.guestId}</td>
                    <td className="px-4 py-3 text-slate-600">{CHANNEL_LABELS[l.channel]}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-sm truncate">{l.subject ?? l.body}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status]}`}>
                        {STATUS_LABELS[l.status]}
                      </span>
                      {l.status === 'failed' && l.failureReason && (
                        <span className="block text-xs text-rose-500 mt-0.5">{l.failureReason}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(l.createdAt).toLocaleString('uz-UZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-500">Hali xabar shabloni yo'q.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nomi</th>
                <th className="text-left px-4 py-2">Sabab</th>
                <th className="text-left px-4 py-2">Kanal</th>
                <th className="text-left px-4 py-2">Holat</th>
                {canEdit && <th className="text-right px-4 py-2">Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-slate-600">{TRIGGER_LABELS[t.triggerType]}</td>
                  <td className="px-4 py-3 text-slate-600">{CHANNEL_LABELS[t.channel]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}
                    >
                      {t.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (!property) return;
                          await apiFetch(`/properties/${property.id}/message-templates/${t.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isActive: !t.isActive }),
                          });
                          load();
                        }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 underline"
                      >
                        {t.isActive ? 'Nofaollashtirish' : 'Faollashtirish'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createTemplateOpen && property && (
        <CreateTemplateModal
          propertyId={property.id}
          onClose={() => setCreateTemplateOpen(false)}
          onSaved={() => {
            setCreateTemplateOpen(false);
            load();
          }}
        />
      )}

      {sendOpen && property && (
        <SendMessageModal
          propertyId={property.id}
          guests={guests}
          templates={templates.filter((t) => t.isActive)}
          onClose={() => setSendOpen(false)}
          onSaved={() => {
            setSendOpen(false);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateTemplateModal({
  propertyId,
  onClose,
  onSaved,
}: {
  propertyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<MessageTriggerType>('custom');
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/message-templates`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          triggerType,
          channel,
          subject: channel === 'email' && subject ? subject : undefined,
          bodyTemplate,
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
    <Modal title="Yangi xabar shabloni" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nomi</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Masalan: Bron tasdiqlash xati"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Sabab (ixtiyoriy kategoriya)</span>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as MessageTriggerType)}
            className="input"
          >
            {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Kanal</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value as MessageChannel)} className="input">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        {channel === 'email' && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Mavzu (ixtiyoriy)</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Salom, {{guestName}}!" />
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Matn</span>
          <textarea
            required
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            className="input"
            rows={4}
            placeholder="{{propertyName}}ga xush kelibsiz, {{guestName}}! Sizning bron sanangiz: {{checkIn}} — {{checkOut}}, xona № {{roomNumber}}."
          />
        </label>
        <p className="text-xs text-slate-400">
          O'rin-bosarlar: {'{{guestName}}'}, {'{{propertyName}}'}, {'{{checkIn}}'}, {'{{checkOut}}'}, {'{{roomNumber}}'}
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Shablonni saqlash'}
        </button>
      </form>
    </Modal>
  );
}

function SendMessageModal({
  propertyId,
  guests,
  templates,
  onClose,
  onSaved,
}: {
  propertyId: string;
  guests: GuestDto[];
  templates: MessageTemplateDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [guestId, setGuestId] = useState(guests[0]?.id ?? '');
  const [mode, setMode] = useState<'template' | 'adhoc'>(templates.length > 0 ? 'template' : 'adhoc');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [channel, setChannel] = useState<MessageChannel | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/messages/send`, {
        method: 'POST',
        body: JSON.stringify({
          guestId,
          templateId: mode === 'template' ? templateId : undefined,
          channel: channel || undefined,
          subject: mode === 'adhoc' && subject ? subject : undefined,
          body: mode === 'adhoc' ? body : undefined,
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
    <Modal title="Yangi xabar yuborish" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Mehmon</span>
          <select value={guestId} onChange={(e) => setGuestId(e.target.value)} className="input" required>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </select>
        </label>

        {templates.length > 0 && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`px-2 py-1 rounded ${mode === 'template' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Shablondan
            </button>
            <button
              type="button"
              onClick={() => setMode('adhoc')}
              className={`px-2 py-1 rounded ${mode === 'adhoc' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Erkin matn
            </button>
          </div>
        )}

        {mode === 'template' ? (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Shablon</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input" required>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({CHANNEL_LABELS[t.channel]})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Kanal (ixtiyoriy — bo'sh qoldirilsa mehmonning afzalligi ishlatiladi)</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as MessageChannel | '')} className="input">
                <option value="">Avtomatik (mehmon afzalligi)</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Mavzu (ixtiyoriy)</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Matn</span>
              <textarea required value={body} onChange={(e) => setBody(e.target.value)} className="input" rows={4} />
            </label>
          </>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
      </form>
    </Modal>
  );
}
