import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { CreateGroupBookingModal } from '../components/CreateGroupBookingModal';
import { AddGroupRoomModal } from '../components/AddGroupRoomModal';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingGroupDto, BookingStatus } from '../lib/types';

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Kutilmoqda',
  confirmed: 'Tasdiqlangan',
  checked_in: 'Joylashtirilgan',
  checked_out: 'Chiqib ketgan',
  cancelled: 'Bekor qilingan',
  no_show: 'Kelmadi',
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-800',
  no_show: 'bg-rose-100 text-rose-800',
};

function groupDateRange(group: BookingGroupDto): string {
  const activeBookings = group.bookings.filter((b) => b.status !== 'cancelled');
  if (activeBookings.length === 0) return '—';
  const checkIns = activeBookings.map((b) => b.checkIn).sort();
  const checkOuts = activeBookings.map((b) => b.checkOut).sort();
  return `${checkIns[0]} — ${checkOuts[checkOuts.length - 1]}`;
}

function groupTotal(group: BookingGroupDto): number {
  return group.bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);
}

export function GroupBookingsPage() {
  const { property, can } = useAuth();
  const [groups, setGroups] = useState<BookingGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailGroup, setDetailGroup] = useState<BookingGroupDto | null>(null);
  const [addRoomOpen, setAddRoomOpen] = useState(false);

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const list = await apiFetch<BookingGroupDto[]>(`/properties/${property.id}/booking-groups`);
      setGroups(list);
      // Detal oynasi ochiq bo'lsa, uni ham yangi ma'lumot bilan yangilaymiz.
      setDetailGroup((prev) => (prev ? (list.find((g) => g.id === prev.id) ?? null) : null));
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
    <AppLayout title="Guruh bronlari">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Korporativ mijoz yoki turizm agentligi uchun bir nechta xonani bitta guruh ostida bron qiling.
        </p>
        {can('booking', 'create') && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary shrink-0">
            + Yangi guruh bron
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">Hali guruh bron yaratilmagan.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Guruh</th>
                <th className="text-left px-4 py-2">Kompaniya</th>
                <th className="text-left px-4 py-2">Sanalar</th>
                <th className="text-left px-4 py-2">Xonalar</th>
                <th className="text-left px-4 py-2">Jami summa</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailGroup(g)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{g.groupName}</td>
                  <td className="px-4 py-3 text-slate-600">{g.companyName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{groupDateRange(g)}</td>
                  <td className="px-4 py-3 text-slate-600">{g.bookings.length}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {groupTotal(g).toLocaleString('uz-UZ')} {g.bookings[0]?.currency ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-navy underline">Batafsil</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && property && (
        <CreateGroupBookingModal
          propertyId={property.id}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {detailGroup && property && (
        <Modal title={detailGroup.groupName} onClose={() => setDetailGroup(null)} width="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {detailGroup.companyName && <Row label="Kompaniya" value={detailGroup.companyName} />}
              {detailGroup.contactName && <Row label="Aloqa shaxsi" value={detailGroup.contactName} />}
              {detailGroup.contactPhone && <Row label="Telefon" value={detailGroup.contactPhone} />}
              {detailGroup.contactEmail && <Row label="Email" value={detailGroup.contactEmail} />}
              {detailGroup.notes && <Row label="Izoh" value={detailGroup.notes} />}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Xonalar ro'yxati (rooming list)</span>
                {can('booking', 'create') && (
                  <button onClick={() => setAddRoomOpen(true)} className="btn-secondary text-xs px-2 py-1">
                    + Xona qo'shish
                  </button>
                )}
              </div>
              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Xona</th>
                      <th className="text-left px-3 py-2">Mehmon</th>
                      <th className="text-left px-3 py-2">Sanalar</th>
                      <th className="text-left px-3 py-2">Holat</th>
                      <th className="text-left px-3 py-2">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailGroup.bookings.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          № {b.room?.roomNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{b.guest?.fullName ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {b.checkIn} — {b.checkOut}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                            {STATUS_LABELS[b.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {Number(b.totalAmount).toLocaleString('uz-UZ')} {b.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Har bir xonani check-in/check-out qilish, xona almashtirish yoki bekor qilish uchun "Bronlar
                taqvimi" bo'limidan foydalaning — guruh shu bronlarni faqat bitta ro'yxat ostida ko'rsatadi.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {addRoomOpen && detailGroup && property && (
        <AddGroupRoomModal
          propertyId={property.id}
          groupId={detailGroup.id}
          onClose={() => setAddRoomOpen(false)}
          onAdded={() => {
            setAddRoomOpen(false);
            load();
          }}
        />
      )}
    </AppLayout>
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
