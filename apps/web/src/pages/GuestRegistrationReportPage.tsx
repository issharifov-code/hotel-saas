import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { GuestRegistrationReportDto } from '../lib/types';

const STAYS_PAGE_SIZE = 50;

// Guest.documentType/documentNumber/nationality/dateOfBirth ustunlari
// (O'zbekistonda mehmonlarni, ayniqsa xorijiy fuqarolarni, migratsiya/politsiya
// organlariga ro'yxatga olib borish talabi uchun saqlanadi — Guest entity
// izohiga qarang) shu paytgacha hech qanday hisobotda birgalikda
// ko'rsatilmagan edi. Bu sahifa ularni birinchi marta haqiqiy ro'yxat sifatida
// chiqaradi va hujjat ma'lumoti to'liq bo'lmagan mehmonlarni belgilaydi.

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: 'Pasport',
  id_card: 'ID karta',
};

const DAY_OPTIONS = [
  { value: 7, label: 'Oxirgi 7 kun' },
  { value: 30, label: 'Oxirgi 30 kun' },
  { value: 90, label: 'Oxirgi 90 kun' },
];

const STATUS_LABELS: Record<string, string> = {
  checked_in: 'Turibdi',
  checked_out: "Chiqib ketgan",
};

function documentTypeLabel(type: string | null): string {
  if (!type) return '—';
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

export function GuestRegistrationReportPage() {
  const { property } = useAuth();
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GuestRegistrationReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Davr (kunlar soni) o'zgarganda, joriy sahifa raqami eski davr uchun
  // bo'lishi mumkin (masalan 90 kunda 3-sahifada turib, 7 kunga o'tsa,
  // 3-sahifa endi mavjud bo'lmasligi mumkin) — shuning uchun 1-sahifaga qaytariladi.
  useEffect(() => {
    setPage(1);
  }, [days]);

  useEffect(() => {
    if (!property) return;
    setError(null);
    apiFetch<GuestRegistrationReportDto>(
      `/properties/${property.id}/reports/guest-registration?days=${days}&page=${page}&pageSize=${STAYS_PAGE_SIZE}`,
    )
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Hisobotni yuklashda xatolik yuz berdi'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, days, page]);

  return (
    <AppLayout title="Mehmonlarni ro'yxatga olish hisoboti">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Tanlangan davrda turgan/turayotgan mehmonlarning hujjat ma'lumotlari — davlat
          organlariga hisobot berish uchun.
        </p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="input w-auto"
        >
          {DAY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Jami turishlar</p>
              <p className="text-2xl font-semibold text-slate-900">{data.totalStays}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Hujjat ma'lumoti to'liq bo'lmaganlar</p>
              <p
                className={`text-2xl font-semibold ${data.missingDocumentCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}
              >
                {data.missingDocumentCount}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {data.stays.length === 0 ? (
              <p className="text-sm text-slate-400">Tanlangan davrda turish qayd etilmagan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4">Mehmon</th>
                      <th className="py-2 pr-4">Fuqaroligi</th>
                      <th className="py-2 pr-4">Hujjat</th>
                      <th className="py-2 pr-4">Tug'ilgan sana</th>
                      <th className="py-2 pr-4">Xona</th>
                      <th className="py-2 pr-4">Sanalar</th>
                      <th className="py-2 pr-4">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.stays.map((s) => (
                      <tr key={s.bookingId} className={s.missingDocument ? 'bg-amber-50' : ''}>
                        <td className="py-2 pr-4 text-slate-800">{s.guestFullName}</td>
                        <td className="py-2 pr-4 text-slate-600">{s.nationality ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">
                          {s.missingDocument ? (
                            <span className="text-amber-700 font-medium">To'liq emas</span>
                          ) : (
                            `${documentTypeLabel(s.documentType)} · ${s.documentNumber}`
                          )}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{s.dateOfBirth ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">{s.roomNumber}</td>
                        <td className="py-2 pr-4 text-slate-600">
                          {s.checkIn} → {s.checkOut}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {STATUS_LABELS[s.status] ?? s.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.totalStays} onPageChange={setPage} />
        </div>
      )}
    </AppLayout>
  );
}
