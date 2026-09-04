import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { profileTypeMeta } from '../lib/profile-types';
import type { GuestDto, ProfileType } from '../lib/types';

// Berilgan TURDAGI profillar ro'yxatidan tanlash (2026-09-04).
//
// Nima uchun alohida komponent: profil turlari qo'shilgandan keyin bir necha
// joyda bir xil savol paydo bo'ldi — "shu turdagi mavjud profillardan birini
// tanla". Har joyda alohida `useEffect` + `select` yozilsa, biri turni
// filtrlashni unutib qo'yishi mumkin edi (va o'shanda, masalan, kompaniya
// profili manba sifatida taklif qilinardi).
//
// Ro'yxat FAQAT so'ralgan turdan iborat: server `?profileType=` filtrini
// qo'llaydi va `create` paytida ham turni qayta tekshiradi.
export function ProfilePicker({
  type,
  value,
  onChange,
  onPick,
  label,
  noneLabel = "— Yo'q —",
  disabled,
  hint,
}: {
  type: ProfileType;
  value: string;
  onChange: (id: string) => void;
  // Tanlangan profilning O'ZI kerak bo'lsa (masalan formani to'ldirish uchun).
  onPick?: (profile: GuestDto | null) => void;
  label?: string;
  noneLabel?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [profiles, setProfiles] = useState<GuestDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await apiFetch<GuestDto[]>(
        `/guests?profileType=${type}`,
      ).catch(() => []);
      if (!cancelled) {
        setProfiles(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const meta = profileTypeMeta(type);

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-900">
        {label ?? meta.shortLabel}
      </span>
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => {
          onChange(e.target.value);
          onPick?.(profiles.find((p) => p.id === e.target.value) ?? null);
        }}
        className="input"
      >
        <option value="">{loading ? 'Yuklanmoqda...' : noneLabel}</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      {/* Ro'yxat bo'm-bo'sh bo'lsa sababi aytiladi — aks holda foydalanuvchi
          "tanlov ishlamayapti" deb o'ylardi. */}
      {!loading && profiles.length === 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          Hali {meta.shortLabel.toLowerCase()} profili yo&apos;q — Profillarni
          boshqarish sahifasida yarating.
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </label>
  );
}
