import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { apiFetch, ApiError } from '../lib/api';
import type { GuestDto, LoyaltyTier } from '../lib/types';

const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  platinum: 'Platina',
};

const TIER_STYLES: Record<LoyaltyTier, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-amber-100 text-amber-800',
  platinum: 'bg-indigo-100 text-indigo-800',
};

// Diagramma chizig'i rangi — nishon rangining to'qroq varianti.
const TIER_BARS: Record<LoyaltyTier, string> = {
  bronze: 'bg-orange-400',
  silver: 'bg-slate-400',
  gold: 'bg-amber-400',
  platinum: 'bg-indigo-400',
};

interface LoyaltyProgram {
  pointsPerCurrencyUnit: number;
  tiers: { tier: LoyaltyTier; threshold: number }[];
}

function raqam(n: number): string {
  return n.toLocaleString('uz-UZ');
}

// Sodiqlik dasturi (2026-09-04, foydalanuvchi so'rovi: "Mijozlar > Profillar >
// Sodiqlik dasturi").
//
// Sahifa QOIDALARNI va DASTUR HOLATINI ko'rsatadi. Ball qo'shish/ayirish
// ataylab bu yerda emas — u aniq bir mehmonga tegishli amal va o'sha
// mehmonning profil oynasidagi "Loyalty" bo'limida qoladi.
export function LoyaltyPage() {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, g] = await Promise.all([
          apiFetch<LoyaltyProgram>('/loyalty/program'),
          // FAQAT mehmon profillari: sodiqlik dasturi jismoniy shaxslar
          // uchun, kompaniya/turagent profillari bu hisobga kirmaydi.
          apiFetch<GuestDto[]>('/guests?profileType=guest'),
        ]);
        setProgram(p);
        setGuests(g);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const taqsimot = useMemo(() => {
    const counts: Record<LoyaltyTier, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };
    for (const g of guests) counts[g.loyaltyTier] = (counts[g.loyaltyTier] ?? 0) + 1;
    return counts;
  }, [guests]);

  const eng = useMemo(
    () => [...guests].sort((a, b) => b.lifetimePoints - a.lifetimePoints).slice(0, 10),
    [guests],
  );

  const jami = guests.length;
  const jamiBall = guests.reduce((s, g) => s + g.loyaltyPoints, 0);

  return (
    <AppLayout
      title="Sodiqlik dasturi"
      help={
        <>
          <p className="font-semibold">Sodiqlik dasturi qanday ishlaydi?</p>
          <p>
            Mehmon to&apos;lov qilganda avtomatik ball to&apos;planadi. Ball ikki
            xil hisoblanadi: <b className="font-medium">joriy ball</b> — sarflash
            mumkin bo&apos;lgan qoldiq (ishlatilganda kamayadi), va{' '}
            <b className="font-medium">umrbod ball</b> — hech qachon kamaymaydigan
            jami. Daraja aynan umrbod ball bo&apos;yicha aniqlanadi, shuning uchun
            ballni sarflagan mehmon darajasini yo&apos;qotmaydi.
          </p>
          <p>
            Ball qo&apos;lda tuzatish kerak bo&apos;lsa (kompensatsiya, xatoni
            to&apos;g&apos;rilash), buni mehmon profilini ochib &quot;Loyalty&quot;
            bo&apos;limidan qilasiz — har bir tuzatish sababi bilan yoziladi.
          </p>
        </>
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}

      {!loading && program && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Dastur a'zolari" value={raqam(jami)} suffix="mehmon" />
            <StatCard label="Jami joriy ball" value={raqam(jamiBall)} suffix="ball" />
            <StatCard
              label="Ball to'planishi"
              value={`1 ball / ${raqam(Math.round(1 / program.pointsPerCurrencyUnit))}`}
              suffix="to'lov summasi"
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="panel-header">Darajalar va bo&apos;sag&apos;alar</h2>
            <div className="divide-y divide-slate-100">
              {program.tiers.map((t) => {
                const soni = taqsimot[t.tier] ?? 0;
                const ulush = jami > 0 ? Math.round((soni / jami) * 100) : 0;
                return (
                  <div key={t.tier} className="flex items-center gap-4 px-4 py-3">
                    <span
                      className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${TIER_STYLES[t.tier]}`}
                    >
                      {TIER_LABELS[t.tier]}
                    </span>
                    <span className="w-40 shrink-0 text-xs text-slate-600">
                      {raqam(t.threshold)} umrbod balldan
                    </span>
                    {/* Ulush chizig'i — foizni raqam bilan birga ko'rsatamiz:
                        faqat chiziq bo'lsa aniq qiymatni o'qib bo'lmaydi. */}
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${TIER_BARS[t.tier]}`}
                        style={{ width: `${ulush}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-slate-600">
                      {raqam(soni)} ta · {ulush}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="panel-header">Eng ko&apos;p ball to&apos;plaganlar</h2>
            {eng.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">
                Hali dastur a&apos;zosi yo&apos;q.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {eng.map((g, i) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 text-xs text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {g.fullName}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLES[g.loyaltyTier]}`}
                    >
                      {TIER_LABELS[g.loyaltyTier]}
                    </span>
                    <span className="w-40 shrink-0 text-right text-xs text-slate-600">
                      {raqam(g.loyaltyPoints)} joriy · {raqam(g.lifetimePoints)} umrbod
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{suffix}</p>
    </div>
  );
}
