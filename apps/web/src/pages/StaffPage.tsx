import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type {
  PermissionActionKey,
  PermissionDto,
  PermissionModuleKey,
  RoleDto,
  SalaryType,
  StaffSalaryDto,
  StaffUserDto,
  UserRoleAssignmentDto,
  UserStatus,
} from '../lib/types';

// Xodimlar va ruxsatlar sahifasi (2026-09): ikkita tab — "Xodimlar" (ro'yxat,
// taklif qilish, rol biriktirish, parolni tiklash, faollashtirish/o'chirish) va
// "Rollar va ruxsatlar" (rollar ro'yxati + har bir rol uchun modul x amal
// ruxsatlar matritsasi). Backend: users.controller.ts va roles.controller.ts.

const MODULE_LABELS: Record<PermissionModuleKey, string> = {
  booking: 'Bronlar / Xonalar',
  front_desk: 'Front Desk',
  housekeeping: 'Housekeeping',
  warehouse: 'Ombor',
  pos: 'POS',
  guest_crm: 'Mehmonlar (CRM)',
  invoicing: 'Hisob-fakturalar',
  accounting: 'Moliyaviy hisob',
  reports: 'Hisobotlar',
  billing: "Obuna va to'lovlar",
  users_roles: 'Xodimlar va ruxsatlar',
  tenant_settings: 'Tizim sozlamalari',
  payroll: 'Ish haqi (Payroll)',
};

const MODULE_ORDER: PermissionModuleKey[] = [
  'booking',
  'front_desk',
  'housekeeping',
  'warehouse',
  'pos',
  'guest_crm',
  'invoicing',
  'accounting',
  'reports',
  'billing',
  'users_roles',
  'tenant_settings',
  'payroll',
];

const ACTION_LABELS: Record<PermissionActionKey, string> = {
  view: "Ko'rish",
  create: 'Yaratish',
  edit: 'Tahrirlash',
  delete: "O'chirish",
  approve: 'Tasdiqlash',
};

const ACTION_ORDER: PermissionActionKey[] = ['view', 'create', 'edit', 'delete', 'approve'];

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Faol',
  invited: 'Taklif yuborilgan',
  disabled: "O'chirilgan",
};

const STATUS_COLORS: Record<UserStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  invited: 'bg-amber-100 text-amber-800',
  disabled: 'bg-slate-200 text-slate-600',
};

type Tab = 'staff' | 'roles';

export function StaffPage() {
  const { user, can } = useAuth();
  // Yuqori paneldagi hamburger-menyu "Rollarni boshqarish"ni to'g'ridan-to'g'ri
  // Rollar tabiga ochish uchun ?tab=roles query-parametrini o'qiydi
  // (Administratsiya > Xodimlar hamon standart "Xodimlar" tabiga ochadi).
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'roles' ? 'roles' : 'staff');
  const [users, setUsers] = useState<StaffUserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [assignFor, setAssignFor] = useState<StaffUserDto | null>(null);
  const [resetFor, setResetFor] = useState<StaffUserDto | null>(null);
  const [salaryFor, setSalaryFor] = useState<StaffUserDto | null>(null);
  const [roleForm, setRoleForm] = useState<RoleDto | 'new' | null>(null);

  const canCreate = can('users_roles', 'create');
  const canEdit = can('users_roles', 'edit') || canCreate;
  const canSalaryEdit = can('payroll', 'edit') || can('payroll', 'create');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r, p, a] = await Promise.all([
        apiFetch<StaffUserDto[]>('/users'),
        apiFetch<RoleDto[]>('/roles'),
        apiFetch<PermissionDto[]>('/permissions'),
        apiFetch<UserRoleAssignmentDto[]>('/user-roles'),
      ]);
      setUsers(u);
      setRoles(r);
      setPermissions(p);
      setAssignments(a);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const rolesForUser = (userId: string) =>
    assignments.filter((a) => a.userId === userId).map((a) => rolesById.get(a.roleId)).filter(Boolean) as RoleDto[];

  const removeRole = async (userId: string, roleId: string) => {
    setError(null);
    try {
      await apiFetch(`/user-roles/${userId}/${roleId}`, { method: 'DELETE' });
      await loadAll();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Rolni olib tashlashda xatolik');
    }
  };

  const toggleStatus = async (target: StaffUserDto) => {
    setError(null);
    const nextStatus: UserStatus = target.status === 'disabled' ? 'active' : 'disabled';
    try {
      await apiFetch(`/users/${target.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Holatni o\'zgartirishda xatolik');
    }
  };

  return (
    <AppLayout title="Xodimlar va ruxsatlar">
      <div className="flex gap-2 mb-6">
        {(['staff', 'roles'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? 'chip-active' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {t === 'staff' ? 'Xodimlar' : 'Rollar va ruxsatlar'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === 'staff' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              Xodimlarni taklif qiling, rollarini biriktiring va kerak bo'lsa parolini tiklang.
            </p>
            {canCreate && (
              <button onClick={() => setShowInvite(true)} className="btn-primary shrink-0">
                + Yangi xodim
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">Hali xodim qo'shilmagan.</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Ism</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Rollar</th>
                    <th className="text-left px-4 py-2">Holat</th>
                    <th className="text-left px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === user?.id;
                    const userRoles = rolesForUser(u.id);
                    return (
                      <tr key={u.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {userRoles.length === 0 && <span className="text-xs text-slate-400">—</span>}
                            {userRoles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 rounded-full bg-brand-navy-light px-2 py-0.5 text-xs font-medium text-brand-navy"
                              >
                                {r.name}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => removeRole(u.id, r.id)}
                                    className="text-brand-navy/60 hover:text-brand-navy"
                                    title="Rolni olib tashlash"
                                  >
                                    &times;
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                            {STATUS_LABELS[u.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(canEdit || canSalaryEdit) && (
                            <div className="flex justify-end gap-3 text-xs">
                              {canEdit && (
                                <>
                                  <button onClick={() => setAssignFor(u)} className="text-brand-navy underline">
                                    Rol biriktirish
                                  </button>
                                  <button onClick={() => setResetFor(u)} className="text-brand-navy underline">
                                    Parolni tiklash
                                  </button>
                                </>
                              )}
                              {canSalaryEdit && (
                                <button onClick={() => setSalaryFor(u)} className="text-brand-navy underline">
                                  Maosh belgilash
                                </button>
                              )}
                              {canEdit && !isSelf && (
                                <button onClick={() => toggleStatus(u)} className="text-brand-navy underline">
                                  {u.status === 'disabled' ? 'Faollashtirish' : "O'chirish"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              Har bir rol — modul bo'yicha ruxsatlar to'plami. Tizim rollarining nomini o'zgartirib bo'lmaydi, lekin
              ruxsatlarini moslashtirish mumkin.
            </p>
            {canCreate && (
              <button onClick={() => setRoleForm('new')} className="btn-primary shrink-0">
                + Yangi rol
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => canEdit && setRoleForm(r)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      {r.name}
                      {r.isSystem && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Tizim roli
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.permissions.length} ta ruxsat</p>
                  </div>
                  {canEdit && <span className="text-xs text-brand-navy underline">Ruxsatlarni tahrirlash</span>}
                </button>
              ))}
              {roles.length === 0 && <p className="p-4 text-sm text-slate-500">Rollar mavjud emas</p>}
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSaved={() => {
            setShowInvite(false);
            loadAll();
          }}
        />
      )}

      {assignFor && (
        <AssignRoleModal
          targetUser={assignFor}
          roles={roles}
          alreadyAssignedRoleIds={rolesForUser(assignFor.id).map((r) => r.id)}
          onClose={() => setAssignFor(null)}
          onSaved={() => {
            setAssignFor(null);
            loadAll();
          }}
        />
      )}

      {resetFor && (
        <ResetPasswordModal
          targetUser={resetFor}
          onClose={() => setResetFor(null)}
          onSaved={() => setResetFor(null)}
        />
      )}

      {salaryFor && (
        <SetSalaryModal
          targetUser={salaryFor}
          onClose={() => setSalaryFor(null)}
          onSaved={() => setSalaryFor(null)}
        />
      )}

      {roleForm && (
        <RoleFormModal
          role={roleForm === 'new' ? null : roleForm}
          permissions={permissions}
          onClose={() => setRoleForm(null)}
          onSaved={() => {
            setRoleForm(null);
            loadAll();
          }}
        />
      )}
    </AppLayout>
  );
}

function InviteUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xodim qo'shishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi xodim" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To'liq ismi</span>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Vaqtinchalik parol</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Yaratilmoqda...' : 'Xodim yaratish'}
        </button>
      </form>
    </Modal>
  );
}

function AssignRoleModal({
  targetUser,
  roles,
  alreadyAssignedRoleIds,
  onClose,
  onSaved,
}: {
  targetUser: StaffUserDto;
  roles: RoleDto[];
  alreadyAssignedRoleIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const availableRoles = roles.filter((r) => !alreadyAssignedRoleIds.includes(r.id));
  const [roleId, setRoleId] = useState(availableRoles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!roleId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/user-roles', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser.id, roleId }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rol biriktirishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`${targetUser.fullName} — rol biriktirish`} onClose={onClose}>
      {availableRoles.length === 0 ? (
        <p className="text-sm text-slate-500">Barcha mavjud rollar allaqachon biriktirilgan.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Rol</span>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="input">
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Biriktirilmoqda...' : 'Biriktirish'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function ResetPasswordModal({
  targetUser,
  onClose,
  onSaved,
}: {
  targetUser: StaffUserDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${targetUser.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Parolni tiklashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Modal title={`${targetUser.fullName} — parol tiklandi`} onClose={onSaved}>
        <p className="text-sm text-slate-600">
          Yangi parolni xodimga xavfsiz usulda yetkazing — u keyingi kirishda shu parolni ishlatadi.
        </p>
        <button onClick={onSaved} className="btn-primary w-full mt-4">
          Tushunarli
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={`${targetUser.fullName} — parolni tiklash`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Yangi parol</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Parolni tiklash'}
        </button>
      </form>
    </Modal>
  );
}

function SetSalaryModal({
  targetUser,
  onClose,
  onSaved,
}: {
  targetUser: StaffUserDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [salaryType, setSalaryType] = useState<SalaryType>('monthly');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<StaffSalaryDto>(`/users/${targetUser.id}/salary`)
      .then((s) => {
        if (s.salaryType) setSalaryType(s.salaryType);
        if (s.salaryAmount) setSalaryAmount(s.salaryAmount);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Maoshni yuklashda xatolik'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${targetUser.id}/salary`, {
        method: 'PATCH',
        body: JSON.stringify({ salaryType, salaryAmount }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Maoshni saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`${targetUser.fullName} — maosh`} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Maosh turi</span>
            <select
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value as SalaryType)}
              className="input"
            >
              <option value="monthly">Oylik</option>
              <option value="hourly">Soatlik</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {salaryType === 'monthly' ? "Oylik maosh summasi" : "Bir soatlik stavka"}
            </span>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              className="input"
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function RoleFormModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: RoleDto | null;
  permissions: PermissionDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = role !== null;
  const [name, setName] = useState(role?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(role?.permissions.map((p) => p.id) ?? []));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const permissionByKey = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p]));

  const toggle = (permissionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await apiFetch(`/roles/${role.id}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify({ permissionIds: Array.from(selectedIds) }),
        });
      } else {
        await apiFetch('/roles', {
          method: 'POST',
          body: JSON.stringify({ name, permissionIds: Array.from(selectedIds) }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rolni saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isEdit ? `${role.name} — ruxsatlar` : 'Yangi rol'} onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {!isEdit && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Rol nomi</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
        )}

        <div className="border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Modul</th>
                {ACTION_ORDER.map((a) => (
                  <th key={a} className="text-center px-2 py-2">
                    {ACTION_LABELS[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_ORDER.map((m) => (
                <tr key={m} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{MODULE_LABELS[m]}</td>
                  {ACTION_ORDER.map((a) => {
                    const perm = permissionByKey.get(`${m}:${a}`);
                    if (!perm) return <td key={a} className="text-center px-2 py-2 text-slate-300">—</td>;
                    return (
                      <td key={a} className="text-center px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(perm.id)}
                          onChange={() => toggle(perm.id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : isEdit ? 'Ruxsatlarni saqlash' : 'Rol yaratish'}
        </button>
      </form>
    </Modal>
  );
}
