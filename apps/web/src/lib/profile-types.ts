import type { ProfileType } from './types';

// Profil turlari (2026-09-04, OPERA Cloud "Manage Profile" referensi).
//
// Backend'dagi `ProfileType` enum va `FIELD_ALLOWED_TYPES` bilan MOS bo'lishi
// shart: bu yerdagi `fields` ro'yxati serverdagi cheklovning aynan ko'zgusi.
// Agar formada serverga ruxsat berilmagan maydon ko'rsatilsa, foydalanuvchi
// to'ldirib "Saqlash" bosgach 400 xato olardi.

export interface ProfileTypeMeta {
  key: ProfileType;
  // Yaratish oynasidagi nom ("Mehmon profili").
  label: string;
  // Ro'yxatdagi/filtrdagi qisqa nom ("Mehmon").
  shortLabel: string;
  // Bir qatorlik tushuntirish — bu tur nima uchun kerakligi.
  hint: string;
  // Ismning bu turdagi ma'nosi (forma yorlig'i).
  nameLabel: string;
}

export const PROFILE_TYPES: ProfileTypeMeta[] = [
  {
    key: 'guest',
    label: 'Mehmon profili',
    shortLabel: 'Mehmon',
    hint: 'Mehmonxonada turadigan jismoniy shaxs',
    nameLabel: "To'liq ism",
  },
  {
    key: 'company',
    label: 'Kompaniya profili',
    shortLabel: 'Kompaniya',
    hint: 'Xodimlarini joylashtiradigan tashkilot',
    nameLabel: 'Tashkilot nomi',
  },
  {
    key: 'travel_agent',
    label: 'Turagent profili',
    shortLabel: 'Turagent',
    hint: 'Bron olib keladigan agentlik (komissiya bilan)',
    nameLabel: 'Agentlik nomi',
  },
  {
    key: 'source',
    label: 'Manba profili',
    shortLabel: 'Manba',
    hint: "Bronlar qayerdan kelayotgani (sayt, OTA, hamkor)",
    nameLabel: 'Manba nomi',
  },
  {
    key: 'group',
    label: 'Guruh profili',
    shortLabel: 'Guruh',
    hint: "Bir nechta bron uchun umumiy nom (to'y, konferensiya)",
    nameLabel: 'Guruh nomi',
  },
  {
    key: 'contact',
    label: 'Kontakt profili',
    shortLabel: 'Kontakt',
    hint: 'Tashkilotdagi aniq odam',
    nameLabel: "To'liq ism",
  },
];

const BY_KEY = new Map(PROFILE_TYPES.map((t) => [t.key, t]));

export function profileTypeMeta(key: ProfileType): ProfileTypeMeta {
  // Server yangi tur qo'shib, frontend hali yangilanmagan bo'lsa — kalitning
  // o'zini ko'rsatamiz, sahifa qulab tushmasin.
  return (
    BY_KEY.get(key) ?? {
      key,
      label: key,
      shortLabel: key,
      hint: '',
      nameLabel: 'Nomi',
    }
  );
}

// Tashkilot turlari — STIR, manzil, shahar, aloqa shaxsi shu turlarda bo'ladi.
export const ORGANIZATION_TYPES: ProfileType[] = [
  'company',
  'travel_agent',
  'source',
];

export function isOrganizationType(key: ProfileType): boolean {
  return ORGANIZATION_TYPES.includes(key);
}
