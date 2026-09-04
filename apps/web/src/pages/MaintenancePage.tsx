import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  MaintenanceTicketDto,
  MaintenanceTicketPriority,
  MaintenanceTicketStatus,
  RoomDto,
} from '../lib/types';

const STATUS_LABELS: Record<MaintenanceTicketStatus, string> = {
  open: 'Ochiq',
  in_progress: 'Jarayonda',
  resolved: 'Hal qilingan',
  cancelled: 'Bekor qilingan',
};

const STATUS_COLORS: Record<MaintenanceTicketStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-500',
};

const PRIORITY_LABELS: Record<MaintenanceTicketPriority, string> = {
  low: 'Past',
  medium: "O'rta",
  high: 'Yuqori',
  urgent: 'Shoshilinch',
};

const PRIORITY_COLORS: Record<MaintenanceTicketPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-rose-100 text-rose-800',
};

const OPEN_STATUSES: MaintenanceTicketStatus[] = ['open', 'in_progress'];

export function MaintenancePage() {
  const { property, can } = useAuth();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<MaintenanceTicketDto | null>(null);

  const canCreate = can('housekeeping', 'create');
  const canEdit = can('housekeeping', 'edit');

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const [roomList, ticketList] = await Promise.all([
        apiFetch<RoomDto[]>(`/properties/${property.id}/rooms`),
        apiFetch<MaintenanceTicketDto[]>(`/properties/${property.id}/maintenance-tickets`),
      ]);
      setRooms(roomList);
      setTickets(ticketList);
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

  const runAction = async (id: string, action: 'start' | 'cancel') => {
    if (!property) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/properties/${property.id}/maintenance-tickets/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppLayout title="Texnik xizmat">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Xonalardagi ta'mirlash talab qiladigan muammolar</p>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary shrink-0" disabled={rooms.length === 0}>
            + Yangi so'rov
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-slate-500">Hali texnik xizmat so'rovi yo'q.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Xona</th>
                <th className="text-left px-4 py-2">Muammo</th>
                <th className="text-left px-4 py-2">Muhimlik</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-left px-4 py-2">Yaratilgan</th>
                <th className="text-right px-4 py-2">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    № {t.room?.roomNumber ?? t.roomId} {t.room?.roomType ? `— ${t.room.roomType.name}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(t.createdAt).toLocaleString('uz-UZ')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {t.status === 'open' && canEdit && (
                        <button
                          disabled={busyId === t.id}
                          onClick={() => runAction(t.id, 'start')}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 underline"
                        >
                          Boshlash
                        </button>
                      )}
                      {OPEN_STATUSES.includes(t.status) && canEdit && (
                        <button
                          disabled={busyId === t.id}
                          onClick={() => setResolveTarget(t)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
                        >
                          Hal qilish
                        </button>
                      )}
                      {OPEN_STATUSES.includes(t.status) && canEdit && (
                        <button
                          disabled={busyId === t.id}
                          onClick={() => runAction(t.id, 'cancel')}
                          className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                        >
                          Bekor qilish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && property && (
        <CreateTicketModal
          propertyId={property.id}
          rooms={rooms}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {resolveTarget && property && (
        <ResolveTicketModal
          propertyId={property.id}
          ticket={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onSaved={() => {
            setResolveTarget(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateTicketModal({
  propertyId,
  rooms,
  onClose,
  onSaved,
}: {
  propertyId: string;
  rooms: RoomDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenanceTicketPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/maintenance-tickets`, {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          title,
          description: description || undefined,
          priority,
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
    <Modal title="Yangi texnik xizmat so'rovi" onClose={onClose}>
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
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Muammo</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Masalan: Konditsioner ishlamayapti"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Muhimlik</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as MaintenanceTicketPriority)}
            className="input"
          >
            <option value="low">Past</option>
            <option value="medium">O'rta</option>
            <option value="high">Yuqori</option>
            <option value="urgent">Shoshilinch</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Tavsif (ixtiyoriy)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Yuborilmoqda...' : "So'rov yaratish"}
        </button>
      </form>
    </Modal>
  );
}

function ResolveTicketModal({
  propertyId,
  ticket,
  onClose,
  onSaved,
}: {
  propertyId: string;
  ticket: MaintenanceTicketDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/maintenance-tickets/${ticket.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNotes: resolutionNotes || undefined }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`So'rovni hal qilish — ${ticket.title}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nima qilindi? (ixtiyoriy)</span>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="input"
            rows={3}
            placeholder="Masalan: Konditsioner ustaxona tomonidan ta'mirlandi"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : "Hal qilindi deb belgilash"}
        </button>
      </form>
    </Modal>
  );
}
