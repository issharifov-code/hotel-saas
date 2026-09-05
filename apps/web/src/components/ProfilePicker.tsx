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
  parentProfileId,
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
  // KONTAKT tanlashda: shu tashkilot profiliga bog'langan kontaktlar (va
  // mustaqil kontaktlar) ko'rsatiladi. Server ham aynan shu qoidani
  // qo'llaydi (BookingsService.resolveContactProfile) — bu yerda filtr
  // xatoni oldindan yo'q qiladi, ya'ni foydalanuvchi 400 xatoga
  // "Saqlash"dan keyin emas, ro'yxatning o'zida duch kelmaydi.
  parentProfileId?: string | null;
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

  // Filtrlash mijoz tomonida: ro'yxat kichik (bir tashkilotda bir nechta
  // kontakt), va tanlangan agentlik o'zgarganda qayta so'rov yubormaslik
  // uchun.
  const visible = parentProfileId
    ? profiles.filter(
        (p) => p.parentProfileId === parentProfileId || p.parentProfileId === null,
      )
    : profiles;

  // Tashkilot almashsa, avval tanlangan kontakt ro'yxatdan chiqib ketishi
  // mumkin — o'shanda tanlov tozalanadi. Aks holda maydon bo'sh ko'rinardi
  // (`select` mos `option` topolmaydi), lekin eski id yuborilib, server 400
  // qaytarardi.
  useEffect(() => {
    if (value && !loading && !visible.some((p) => p.id === value)) {
      onChange('');
      onPick?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loading, parentProfileId, profiles]);

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
          onPick?.(visible.find((p) => p.id === e.target.value) ?? null);
        }}
        className="input"
      >
        <option value="">{loading ? 'Yuklanmoqda...' : noneLabel}</option>
        {visible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      {/* Ro'yxat bo'm-bo'sh bo'lsa sababi aytiladi — aks holda foydalanuvchi
          "tanlov ishlamayapti" deb o'ylardi. */}
      {!loading && visible.length === 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          {parentProfileId
            ? `Bu tashkilotning ${meta.shortLabel.toLowerCase()} profili yo'q — Profillarni boshqarish sahifasida yarating va tashkilotga bog'lang.`
            : `Hali ${meta.shortLabel.toLowerCase()} profili yo'q — Profillarni boshqarish sahifasida yarating.`}
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </label>
  );
}
