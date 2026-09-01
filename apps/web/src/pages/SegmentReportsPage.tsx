import { useEffect, useState, type ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { BookingSource, MarketSegment, SegmentPerformanceDto } from '../lib/types';

// Reports moduli allaqachon yozayotgan (lekin hech qachon o'qimayotgan)
// Booking.marketSegment/source/agencyId/corporateAccountId ustunlarini
// birinchi marta haqiqiy tahlilga bog'laydi — "qaysi segment/kanal/hamkor
// qancha daromad keltiryapti" savoliga javob beradi.

const MARKET_SEGMENT_LABELS: Record<MarketSegment, string> = {
  walk_in: 'Walk-in',
  corporate: 'Korporativ',
  ota: 'OTA (Booking.com va h.k.)',
  travel_agent: 'Turizm agentligi',
  group: 'Guruh',
  government: "Davlat tashkiloti",
  other: 'Boshqa',
};

const SOURCE_LABELS: Record<BookingSource, string> = {
  direct: 'Resepshn',
  website: "Jonli bron (veb-sayt)",
  ota: 'OTA',
  exely: 'Exely',
};

const DAY_OPTIONS = [
  { value: 30, label: 'Oxirgi 30 kun' },
  { value: 90, label: 'Oxirgi 90 kun' },
  { value: 365, label: 'Oxirgi 365 kun' },
];

function money(n: number, currency: string): string {
  return `${n.toLocaleString('uz-UZ')} ${currency}`;
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900 mb-3">{title}</p>
      {children}
    </div>
  );
}

export function SegmentReportsPage() {
  const { property } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SegmentPerformanceDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!property) return;
    setError(null);
    apiFetch<SegmentPerformanceDto>(`/properties/${property.id}/reports/segment-performance?days=${days}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Hisobotni yuklashda xatolik yuz berdi'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, days]);

  const currency = property?.currency ?? 'UZS';

  return (
    <AppLayout title="Daromad tahlili (segment, kanal, hamkorlar)">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Qaysi bozor segmenti, kanal, agentlik yoki korporativ hamkor mehmonxonaga qancha daromad
          keltirayotganini ko'rsatadi.
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
          <SectionCard title="Bozor segmenti bo'yicha">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-4">Segment</th>
                    <th className="py-2 pr-4">Bronlar</th>
                    <th className="py-2 pr-4">Kecha-xona</th>
                    <th className="py-2 pr-4">Daromad</th>
                    <th className="py-2 pr-4">ADR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.bySegment.map((s) => (
                    <tr key={s.segment}>
                      <td className="py-2 pr-4 text-slate-800">{MARKET_SEGMENT_LABELS[s.segment]}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.bookingCount}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.roomNights}</td>
                      <td className="py-2 pr-4 text-slate-800 font-medium">{money(s.revenue, currency)}</td>
                      <td className="py-2 pr-4 text-slate-600">{money(s.adr, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Kanal (bron manbai) bo'yicha">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-4">Kanal</th>
                    <th className="py-2 pr-4">Bronlar</th>
                    <th className="py-2 pr-4">Daromad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.bySource.map((s) => (
                    <tr key={s.source}>
                      <td className="py-2 pr-4 text-slate-800">{SOURCE_LABELS[s.source]}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.bookingCount}</td>
                      <td className="py-2 pr-4 text-slate-800 font-medium">{money(s.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Turizm agentliklari bo'yicha">
              {data.byAgency.length === 0 ? (
                <p className="text-sm text-slate-400">Tanlangan davrda agentlik orqali bron bo'lmagan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-4">Agentlik</th>
                        <th className="py-2 pr-4">Bronlar</th>
                        <th className="py-2 pr-4">Daromad</th>
                        <th className="py-2 pr-4">Komissiya qarzi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.byAgency.map((a) => (
                        <tr key={a.agencyId}>
                          <td className="py-2 pr-4 text-slate-800">{a.agencyName}</td>
                          <td className="py-2 pr-4 text-slate-600">{a.bookingCount}</td>
                          <td className="py-2 pr-4 text-slate-800 font-medium">{money(a.revenue, currency)}</td>
                          <td className="py-2 pr-4 text-amber-700">{money(a.commissionOwed, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Korporativ hisoblar (City Ledger) bo'yicha">
              {data.byCorporateAccount.length === 0 ? (
                <p className="text-sm text-slate-400">Tanlangan davrda korporativ hisob orqali bron bo'lmagan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-4">Kompaniya</th>
                        <th className="py-2 pr-4">Bronlar</th>
                        <th className="py-2 pr-4">Daromad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.byCorporateAccount.map((c) => (
                        <tr key={c.corporateAccountId}>
                          <td className="py-2 pr-4 text-slate-800">{c.name}</td>
                          <td className="py-2 pr-4 text-slate-600">{c.bookingCount}</td>
                          <td className="py-2 pr-4 text-slate-800 font-medium">{money(c.revenue, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
