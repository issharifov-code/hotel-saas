import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { HousekeepingStatus, HousekeepingTaskDto, RoomDto } from '../lib/types';

type Tab = 'rooms' | 'tasks';

const HK_LABELS: Record<HousekeepingStatus, string> = {
  clean: 'Toza',
  dirty: 'Iflos',
  in_progress: 'Tozalanmoqda',
  inspected: 'Tekshirilgan',
};

const HK_STYLES: Record<HousekeepingStatus, string> = {
  clean: 'bg-emerald-100 text-emerald-800',
  dirty: 'bg-rose-100 text-rose-800',
  in_progress: 'bg-amber-100 text-amber-800',
  inspected: 'bg-blue-100 text-blue-800',
};

const TASK_LABELS: Record<HousekeepingTaskDto['status'], string> = {
  pending: 'Kutilmoqda',
  in_progress: 'Bajarilmoqda',
  done: 'Bajarildi',
  inspected: 'Tekshirildi',
  cancelled: 'Bekor qilingan',
};

const TASK_STYLES: Record<HousekeepingTaskDto['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-emerald-100 text-emerald-800',
  inspected: 'bg-indigo-100 text-indigo-800',
  cancelled: 'bg-slate-200 text-slate-500',
};

const OPEN_TASK_STATUSES: HousekeepingTaskDto['status'][] = ['pending', 'in_progress'];

export function HousekeepingPage() {
  const { property, can } = useAuth();
  const [tab, setTab] = useState<Tab>('rooms');
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const [roomList, taskList] = await Promise.all([
        apiFetch<RoomDto[]>(`/properties/${property.id}/housekeeping/rooms`),
        apiFetch<HousekeepingTaskDto[]>(`/properties/${property.id}/housekeeping/tasks`),
      ]);
      setRooms(roomList);
      setTasks(taskList);
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

  const runTaskAction = async (id: string, action: 'start' | 'complete' | 'inspect' | 'cancel') => {
    if (!property) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/properties/${property.id}/housekeeping/tasks/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  };

  const createTaskForRoom = async (roomId: string) => {
    if (!property) return;
    setBusyId(roomId);
    setError(null);
    try {
      await apiFetch(`/properties/${property.id}/housekeeping/tasks`, {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  };

  const roomHasOpenTask = (roomId: string) =>
    tasks.some((t) => t.roomId === roomId && OPEN_TASK_STATUSES.includes(t.status));

  const canCreate = can('housekeeping', 'create');
  const canEdit = can('housekeeping', 'edit');
  const canApprove = can('housekeeping', 'approve');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rooms', label: 'Xonalar holati' },
    { key: 'tasks', label: 'Vazifalar' },
  ];

  return (
    <AppLayout title="Housekeeping">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : tab === 'rooms' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {rooms.length === 0 && <p className="text-sm text-slate-500">Hali xona yo'q</p>}
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-slate-900">№ {room.roomNumber}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${HK_STYLES[room.housekeepingStatus]}`}>
                  {HK_LABELS[room.housekeepingStatus]}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{room.roomType?.name ?? ''}</p>
              {canCreate && room.housekeepingStatus !== 'clean' && room.housekeepingStatus !== 'inspected' && !roomHasOpenTask(room.id) && (
                <button
                  disabled={busyId === room.id}
                  onClick={() => createTaskForRoom(room.id)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Vazifa yaratish
                </button>
              )}
              {roomHasOpenTask(room.id) && <p className="text-xs text-slate-400">Vazifa navbatda</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {tasks.length === 0 && <p className="p-4 text-sm text-slate-500">Hali vazifa yo'q</p>}
          {tasks.map((task) => (
            <div key={task.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-slate-900">
                    № {task.room?.roomNumber ?? task.roomId} {task.room?.roomType ? `— ${task.room.roomType.name}` : ''}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TASK_STYLES[task.status]}`}>
                    {TASK_LABELS[task.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {task.notes ?? '—'} · {new Date(task.createdAt).toLocaleString('uz-UZ')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {task.status === 'pending' && canEdit && (
                  <button
                    disabled={busyId === task.id}
                    onClick={() => runTaskAction(task.id, 'start')}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 underline"
                  >
                    Boshlash
                  </button>
                )}
                {task.status === 'in_progress' && canEdit && (
                  <button
                    disabled={busyId === task.id}
                    onClick={() => runTaskAction(task.id, 'complete')}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Yakunlash
                  </button>
                )}
                {task.status === 'done' && canApprove && (
                  <button
                    disabled={busyId === task.id}
                    onClick={() => runTaskAction(task.id, 'inspect')}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
                  >
                    Tekshirish
                  </button>
                )}
                {OPEN_TASK_STATUSES.includes(task.status) && canEdit && (
                  <button
                    disabled={busyId === task.id}
                    onClick={() => runTaskAction(task.id, 'cancel')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                  >
                    Bekor qilish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
