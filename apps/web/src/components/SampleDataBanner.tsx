import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { Modal } from './Modal';

// Yangi ro'yxatdan o'tgan har bir tenant avtomatik namunaviy (demo) ma'lumotlar
// bilan boshlanadi (SampleDataService, backend). `user.hasSampleData` true bo'lgan
// ekan — shu banner ko'rinadi va foydalanuvchi tanishib chiqqach ularni o'chirishi
// mumkin. O'chirish BUTUN tenant uchun barcha tegishli yozuvlarni (nafaqat aslida
// avtomatik yaratilganlarini) o'chiradi, shuning uchun ogohlantirish aniq bo'lishi kerak.
export function SampleDataBanner() {
  const { user, refresh, can } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.hasSampleData) return null;
  // 🔴 2026-09-05 (audit): bu tekshiruv yo'q edi. `hasSampleData` — TENANT
  // bayrog'i, ya'ni yangi mehmonxonaning HAR BIR xodimi (front-desk, POS,
  // farrosh) butun tenant ma'lumotini o'chiradigan tugmani ko'rardi va
  // bosgach 403 olardi. Backend `tenant_settings:delete` talab qiladi —
  // standart rollarda faqat Egasida bor.
  if (!can('tenant_settings', 'delete')) return null;

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await apiFetch('/sample-data', { method: 'DELETE' });
      await refresh();
      // Deyarli har bir sahifa (bronlar, mehmonlar, ombor, POS, hisob-fakturalar...)
      // shu ma'lumotlarga bog'liq — hammasi bo'sh holatni to'g'ri aks ettirishi uchun
      // eng ishonchli yo'l butun ilovani qayta yuklash.
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "O'chirishda xatolik yuz berdi");
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-sm text-amber-900">
          <span className="font-medium">Bu tizimda namunaviy (demo) ma'lumotlar mavjud</span>
          <span className="text-amber-700">
            {' '}
            — xonalar, mehmonlar, bronlar va boshqalar tanishish uchun oldindan to'ldirilgan.
          </span>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          Namunaviy ma'lumotlarni o'chirish
        </button>
      </div>

      {showConfirm && (
        <Modal title="Namunaviy ma'lumotlarni o'chirish" onClose={() => (removing ? null : setShowConfirm(false))}>
          <p className="text-sm text-slate-600">
            Bu amal joriy mehmonxonadagi <span className="font-medium">barcha</span> mehmonlar,
            bronlar, hisob-fakturalar, ombor va POS yozuvlarini, housekeeping vazifalarini hamda
            narx rejalarini butunlay o'chiradi — nafaqat dastlab namuna sifatida yaratilganlarini,
            balki shu vaqtgacha O'ZINGIZ kiritgan ma'lumotlarni ham. Xona turlari va xonalar
            tuzilmasi saqlanib qoladi (faqat bandlik/tozalik holati bo'shatiladi).
          </p>
          <p className="mt-2 text-sm font-medium text-rose-600">Bu amalni ortga qaytarib bo'lmaydi.</p>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={removing}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-brand-navy hover:bg-slate-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={remove}
              disabled={removing}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {removing ? "O'chirilmoqda..." : "Ha, hammasini o'chirish"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
