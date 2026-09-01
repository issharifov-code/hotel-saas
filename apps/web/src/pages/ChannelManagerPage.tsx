import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  ChannelDto,
  ChannelProvider,
  ChannelRoomTypeMappingDto,
  ChannelSyncLogDto,
  RatePlanDto,
  RoomTypeDto,
} from '../lib/types';

const PROVIDER_LABELS: Record<ChannelProvider, string> = {
  booking_com: 'Booking.com',
  airbnb: 'Airbnb',
  agoda: 'Agoda',
  expedia: 'Expedia',
  other: 'Boshqa',
};

export function ChannelManagerPage() {
  const { property, can } = useAuth();
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailChannel, setDetailChannel] = useState<ChannelDto | null>(null);

  const canCreate = can('booking', 'create');
  const canEdit = can('booking', 'edit') || canCreate;

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const list = await apiFetch<ChannelDto[]>(`/properties/${property.id}/channels`);
      setChannels(list);
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
    <AppLayout title="Channel Manager (OTA kanallari)">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          OTA kanallariga (Booking.com, Airbnb va h.k.) xona turlarini bog'lab, mavjudlik va narxni
          markazlashtirilgan holda yuboring (sync) — bir nechta kanalda bir vaqtda ortiqcha bron
          (overbooking) bo'lishining oldini olish uchun.
        </p>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
            + Yangi kanal
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : channels.length === 0 ? (
        <p className="text-sm text-slate-500">Hali kanal qo'shilmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nomi</th>
                <th className="text-left px-4 py-2">Provayder</th>
                <th className="text-left px-4 py-2">So'nggi sinxronlash</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailChannel(c)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{PROVIDER_LABELS[c.provider]}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString('uz-UZ') : "Hali yo'q"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-navy underline">Boshqarish</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && property && (
        <CreateChannelModal
          propertyId={property.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {detailChannel && property && (
        <ChannelDetailModal
          propertyId={property.id}
          channel={detailChannel}
          canEdit={canEdit}
          onClose={() => setDetailChannel(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateChannelModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ChannelProvider>('booking_com');
  const [externalPropertyId, setExternalPropertyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          provider,
          externalPropertyId: externalPropertyId || undefined,
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
    <Modal title="Yangi kanal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Kanal nomi</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Masalan: Booking.com — Asosiy"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Provayder</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ChannelProvider)}
            className="input"
          >
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Tashqi mulk ID (ixtiyoriy)
          </span>
          <input
            value={externalPropertyId}
            onChange={(e) => setExternalPropertyId(e.target.value)}
            className="input"
            placeholder="OTA tizimidagi property ID"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Kanal yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function ChannelDetailModal({
  propertyId,
  channel,
  canEdit,
  onClose,
  onChanged,
}: {
  propertyId: string;
  channel: ChannelDto;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeDto[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanDto[]>([]);
  const [mappings, setMappings] = useState<ChannelRoomTypeMappingDto[]>([]);
  const [syncLogs, setSyncLogs] = useState<ChannelSyncLogDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const [rt, rp, m, logs] = await Promise.all([
        apiFetch<RoomTypeDto[]>(`/properties/${propertyId}/room-types`),
        apiFetch<RatePlanDto[]>(`/properties/${propertyId}/rate-plans`),
        apiFetch<ChannelRoomTypeMappingDto[]>(`/properties/${propertyId}/channels/${channel.id}/mappings`),
        apiFetch<ChannelSyncLogDto[]>(`/properties/${propertyId}/channels/${channel.id}/sync-logs`),
      ]);
      setRoomTypes(rt);
      setRatePlans(rp);
      setMappings(m);
      setSyncLogs(logs);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const runSync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    setError(null);
    try {
      const log = await apiFetch<ChannelSyncLogDto>(
        `/properties/${propertyId}/channels/${channel.id}/sync`,
        { method: 'POST' },
      );
      setSyncNotice(
        log.status === 'success'
          ? `Sinxronlash muvaffaqiyatli: ${log.summary}`
          : `Sinxronlash muvaffaqiyatsiz: ${log.failureReason ?? "Noma'lum xato"}`,
      );
      onChanged();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal title={channel.name} onClose={onClose} width="max-w-3xl">
      <div className="space-y-5">
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600">Xona turi xaritalash (mapping)</p>
            {canEdit && (
              <button onClick={runSync} disabled={syncing} className="btn-primary text-xs px-3 py-1.5">
                {syncing ? 'Sinxronlanmoqda...' : 'Sinxronlash'}
              </button>
            )}
          </div>
          {syncNotice && <p className="text-xs text-slate-600 mb-2">{syncNotice}</p>}
          <div className="border border-slate-200 rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-1.5">Xona turi</th>
                  <th className="text-left px-3 py-1.5">Narx rejasi</th>
                  <th className="text-left px-3 py-1.5">Tashqi ID</th>
                  <th className="text-left px-3 py-1.5">Faol</th>
                  <th className="text-left px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <MappingRow
                    key={rt.id}
                    propertyId={propertyId}
                    channelId={channel.id}
                    roomType={rt}
                    ratePlans={ratePlans.filter((rp) => rp.roomTypeId === rt.id)}
                    mapping={mappings.find((m) => m.roomTypeId === rt.id) ?? null}
                    canEdit={canEdit}
                    onSaved={load}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Sinxronlash tarixi</p>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-slate-500">Hali sinxronlanmagan.</p>
          ) : (
            <div className="border border-slate-200 rounded-md max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5">Sana</th>
                    <th className="text-left px-3 py-1.5">Holat</th>
                    <th className="text-left px-3 py-1.5">Tafsilot</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{new Date(log.syncedAt).toLocaleString('uz-UZ')}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            log.status === 'success'
                              ? 'text-emerald-700 font-medium'
                              : 'text-rose-600 font-medium'
                          }
                        >
                          {log.status === 'success' ? 'Muvaffaqiyatli' : 'Muvaffaqiyatsiz'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {log.status === 'success' ? log.summary : log.failureReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MappingRow({
  propertyId,
  channelId,
  roomType,
  ratePlans,
  mapping,
  canEdit,
  onSaved,
}: {
  propertyId: string;
  channelId: string;
  roomType: RoomTypeDto;
  ratePlans: RatePlanDto[];
  mapping: ChannelRoomTypeMappingDto | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [ratePlanId, setRatePlanId] = useState(mapping?.ratePlanId ?? '');
  const [externalRoomTypeId, setExternalRoomTypeId] = useState(mapping?.externalRoomTypeId ?? '');
  const [isActive, setIsActive] = useState(mapping?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/properties/${propertyId}/channels/${channelId}/mappings/${roomType.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ratePlanId: ratePlanId || null,
          externalRoomTypeId: externalRoomTypeId || null,
          isActive,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-1.5 font-medium text-slate-900">{roomType.name}</td>
      <td className="px-3 py-1.5">
        <select
          disabled={!canEdit}
          value={ratePlanId}
          onChange={(e) => setRatePlanId(e.target.value)}
          className="input text-xs py-1"
        >
          <option value="">Bazaviy narx ({Number(roomType.basePrice).toLocaleString('uz-UZ')})</option>
          {ratePlans.map((rp) => (
            <option key={rp.id} value={rp.id}>
              {rp.name} ({Number(rp.nightlyPrice).toLocaleString('uz-UZ')})
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <input
          disabled={!canEdit}
          value={externalRoomTypeId}
          onChange={(e) => setExternalRoomTypeId(e.target.value)}
          className="input text-xs py-1"
          placeholder="OTA xona turi ID"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          disabled={!canEdit}
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </td>
      <td className="px-3 py-1.5">
        {canEdit && (
          <button onClick={save} disabled={saving} className="btn-secondary text-xs px-2 py-1">
            {saving ? '...' : 'Saqlash'}
          </button>
        )}
      </td>
    </tr>
  );
}
