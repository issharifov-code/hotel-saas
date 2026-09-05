import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  AttendanceRecordDto,
  AttendanceStatus,
  LeaveRequestDto,
  LeaveRequestStatus,
  LeaveType,
  StaffRosterEntryDto,
} from '../lib/types';

// Davomat va ta'til sahifasi (2026-09): Payroll'da hujjatlashtirilgan
// "davomat moduli hali yo'q" bo'shlig'ini to'ldiradi — HOURLY xodimlarning
// oylik soati endi shu yerda qayd etiladi va PayrollService.createRun uni
// avtomatik taklif qiladi. Mavjud `payroll` PermissionModule qayta
// ishlatiladi (Egasi/Buxgalter). Backend: attendance.controller.ts,
// leave-requests.controller.ts.

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Ishda',
  absent: "Kelmagan",
  leave: "Ta'tilda",
  holiday: 'Dam olish',
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Yillik ta'til",
  sick: 'Kasallik varaqasi',
  unpaid: "Ish haqisiz ruxsat",
  other: 'Boshqa',
};

const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Ko'rib chiqilmoqda",
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  cancelled: 'Bekor qilingan',
};

const LEAVE_STATUS_COLORS: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

export function AttendancePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'attendance' | 'leave'>('attendance');

  const canView = can('payroll', 'view');
  const canEdit = can('payroll', 'edit');
  const canCreate = can('payroll', 'create');
  const canApprove = can('payroll', 'approve');

  return (
    <AppLayout title="Davomat va ta'til">
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTab('attendance')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            tab === 'attendance'
              ? 'chip-active'
              : 'bg-white border border-slate-200 text-brand-navy hover:bg-slate-100'
          }`}
        >
          Kunlik davomat
        </button>
        <button
          onClick={() => setTab('leave')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            tab === 'leave'
              ? 'chip-active'
              : 'bg-white border border-slate-200 text-brand-navy hover:bg-slate-100'
          }`}
        >
          Ta'til so'rovlari
        </button>
      </div>

      {!canView ? (
        <p className="text-sm text-slate-500">Bu bo'limni ko'rish uchun ruxsatingiz yo'q.</p>
      ) : tab === 'attendance' ? (
        <AttendanceTab canEdit={canEdit} />
      ) : (
        <LeaveTab canCreate={canCreate} canEdit={canEdit} canApprove={canApprove} />
      )}
    </AppLayout>
  );
}

function AttendanceTab({ canEdit }: { canEdit: boolean }) {
  const { property } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [roster, setRoster] = useState<StaffRosterEntryDto[]>([]);
  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!property) return;
    apiFetch<StaffRosterEntryDto[]>(`/properties/${property.id}/attendance/staff`)
      .then(setRoster)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Xodimlar ro'yxatini yuklashda xatolik"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const loadRecords = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<AttendanceRecordDto[]>(
        `/properties/${property.id}/attendance?date=${date}`,
      );
      setRecords(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Davomatni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, date]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Har bir kun uchun xodimning ishda/kelmagan/ta'tilda holatini va (soatlik xodimlar uchun) ishlagan soatini
          qayd eting — Payroll ishga tushirilganda bu soatlar avtomatik taklif qilinadi.
        </p>
        <label className="shrink-0 ml-4">
          <span className="sr-only">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-slate-500">Faol xodim topilmadi.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Xodim</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-right px-4 py-2">Soat</th>
                <th className="text-left px-4 py-2">Izoh</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {roster.map((staff) => (
                <AttendanceRow
                  key={staff.id}
                  propertyId={property!.id}
                  date={date}
                  staff={staff}
                  record={records.find((r) => r.userId === staff.id) ?? null}
                  editable={canEdit}
                  onSaved={loadRecords}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttendanceRow({
  propertyId,
  date,
  staff,
  record,
  editable,
  onSaved,
}: {
  propertyId: string;
  date: string;
  staff: StaffRosterEntryDto;
  record: AttendanceRecordDto | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? 'present');
  const [hoursWorked, setHoursWorked] = useState(record?.hoursWorked ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(record?.status ?? 'present');
    setHoursWorked(record?.hoursWorked ?? '');
    setNotes(record?.notes ?? '');
    setDirty(false);
  }, [record, date]);

  const save = async () => {
    setSaving(true);
    setRowError(null);
    try {
      const body: Record<string, unknown> = { status, notes: notes || undefined };
      if (hoursWorked !== '') body.hoursWorked = Number(hoursWorked);
      await apiFetch(`/properties/${propertyId}/attendance/${staff.id}/${date}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      setRowError(e instanceof ApiError ? e.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-2">
        <p className="font-medium text-slate-900">{staff.fullName}</p>
        <p className="text-xs text-slate-400">{staff.salaryType === 'hourly' ? 'Soatlik' : 'Oylik'}</p>
      </td>
      <td className="px-4 py-2">
        {editable ? (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AttendanceStatus);
              setDirty(true);
            }}
            className="input py-1"
          >
            {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          STATUS_LABELS[status]
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {editable ? (
          <input
            type="number"
            min={0}
            max={24}
            step="0.5"
            placeholder="—"
            value={hoursWorked}
            onChange={(e) => {
              setHoursWorked(e.target.value);
              setDirty(true);
            }}
            className="input w-20 text-right py-1"
          />
        ) : (
          hoursWorked || '—'
        )}
      </td>
      <td className="px-4 py-2">
        {editable ? (
          <input
            type="text"
            maxLength={500}
            placeholder="Izoh (ixtiyoriy)"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            className="input py-1"
          />
        ) : (
          notes || '—'
        )}
      </td>
      {editable && (
        <td className="px-4 py-2 text-right">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="text-xs text-brand-navy underline disabled:text-slate-300 disabled:no-underline"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {rowError && <p className="text-rose-600 text-[11px] mt-0.5">{rowError}</p>}
        </td>
      )}
    </tr>
  );
}

function LeaveTab({
  canCreate,
  canEdit,
  canApprove,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const { property } = useAuth();
  const [roster, setRoster] = useState<StaffRosterEntryDto[]>([]);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!property) return;
    apiFetch<StaffRosterEntryDto[]>(`/properties/${property.id}/attendance/staff`).then(setRoster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const list = await apiFetch<LeaveRequestDto[]>(
        `/properties/${property.id}/leave-requests${query}`,
      );
      setRequests(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "So'rovlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, statusFilter]);

  const nameFor = (userId: string) => roster.find((s) => s.id === userId)?.fullName ?? userId;

  const decide = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setBusyId(id);
    try {
      await apiFetch(`/properties/${property!.id}/leave-requests/${id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? undefined : JSON.stringify({}),
      });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Amalni bajarishda xatolik');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeaveRequestStatus | '')}
          className="input w-auto"
        >
          <option value="">Barcha holatlar</option>
          {(Object.keys(LEAVE_STATUS_LABELS) as LeaveRequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {LEAVE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
            + Yangi so'rov
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">Hali ta'til so'rovi yo'q.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Xodim</th>
                <th className="text-left px-4 py-2">Turi</th>
                <th className="text-left px-4 py-2">Sanalar</th>
                <th className="text-left px-4 py-2">Holat</th>
                <th className="text-left px-4 py-2">Izoh</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 font-medium text-slate-900">{nameFor(r.userId)}</td>
                  <td className="px-4 py-2">{LEAVE_TYPE_LABELS[r.leaveType]}</td>
                  <td className="px-4 py-2">
                    {r.startDate} — {r.endDate}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAVE_STATUS_COLORS[r.status]}`}
                    >
                      {LEAVE_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {r.reason && <p>{r.reason}</p>}
                    {r.decisionNotes && <p className="text-slate-400">Qaror: {r.decisionNotes}</p>}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    {r.status === 'pending' && canApprove && (
                      <>
                        <button
                          onClick={() => decide(r.id, 'approve')}
                          disabled={busyId === r.id}
                          className="text-xs text-emerald-700 underline"
                        >
                          Tasdiqlash
                        </button>
                        <button
                          onClick={() => decide(r.id, 'reject')}
                          disabled={busyId === r.id}
                          className="text-xs text-rose-600 underline"
                        >
                          Rad etish
                        </button>
                      </>
                    )}
                    {r.status === 'pending' && canEdit && (
                      <button
                        onClick={() => decide(r.id, 'cancel')}
                        disabled={busyId === r.id}
                        className="text-xs text-brand-navy underline"
                      >
                        Bekor qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && property && (
        <CreateLeaveRequestModal
          propertyId={property.id}
          roster={roster}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateLeaveRequestModal({
  propertyId,
  roster,
  onClose,
  onSaved,
}: {
  propertyId: string;
  roster: StaffRosterEntryDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(roster[0]?.id ?? '');
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/properties/${propertyId}/leave-requests`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          leaveType,
          startDate,
          endDate,
          reason: reason || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "So'rov yaratishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi ta'til so'rovi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Xodim</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} required className="input">
            {roster.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Turi</span>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            className="input"
          >
            {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Boshlanish sanasi</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Tugash sanasi</span>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Sabab (ixtiyoriy)</span>
          <input
            type="text"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting || !userId} className="btn-primary w-full">
          {submitting ? 'Yuborilmoqda...' : "So'rov yuborish"}
        </button>
      </form>
    </Modal>
  );
}
