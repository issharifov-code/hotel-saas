import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_TYPES,
  PROFILE_TYPES,
  isOrganizationType,
  profileTypeMeta,
} from './profile-types';
import type { ProfileType } from './types';

// 🔬 PROFIL TURLARI — FRONTEND VA BACKEND SHARTNOMASI (2026-09-05).
//
// MUAMMO SHAKLI. Profil turlari IKKI JOYDA e'lon qilingan: backend'da
// `ProfileType` enum (guest.entity.ts) va frontend'da shu nomdagi union
// (lib/types.ts) hamda ularning ma'lumotlari (PROFILE_TYPES). Ikkalasi
// bir-biriga bog'lanmagan — monorepo bo'lsa ham, web paketi api
// paketidan import qilmaydi (bog'liqlik yo'nalishi ataylab bir tomonlama).
//
// Ya'ni backend'ga yangi tur qo'shilsa yoki eskisi olib tashlansa,
// frontend HECH NARSA sezmaydi: kompilyator jim, testlar yashil, va
// nuqson faqat foydalanuvchi o'sha turni tanlaganda ko'rinadi.
//
// YECHIM SHAKLI. Bu test backend faylini MATN sifatida o'qib, ikkala
// ro'yxatni solishtiradi. Bu g'ayrioddiy usul, lekin muqobili yo'q:
// haqiqiy import bog'liqlik yo'nalishini buzardi, kod generatsiyasi esa
// bu hajmdagi ro'yxat uchun ortiqcha. Backend fayli ko'chirilsa test
// "fayl topilmadi" bilan yiqiladi — bu ham to'g'ri signal.

const API_ENTITY = resolve(
  __dirname,
  '../../../api/src/modules/guests/entities/guest.entity.ts',
);

function readApiSource(): string {
  return readFileSync(API_ENTITY, 'utf8');
}

/** Backend'dagi `enum ProfileType { ... }` ichidan qiymatlarni oladi. */
function apiProfileTypes(): string[] {
  const block = readApiSource().match(/export enum ProfileType \{([\s\S]*?)\}/);
  if (!block) throw new Error('Backend `ProfileType` enum topilmadi');
  return [...block[1].matchAll(/=\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

/** Backend'dagi `ORGANIZATION_PROFILE_TYPES` ro'yxatini oladi. */
function apiOrganizationTypes(): string[] {
  const block = readApiSource().match(
    /ORGANIZATION_PROFILE_TYPES: ProfileType\[\] = \[([\s\S]*?)\]/,
  );
  if (!block) throw new Error('Backend `ORGANIZATION_PROFILE_TYPES` topilmadi');
  const enumNames = [...block[1].matchAll(/ProfileType\.([A-Z_]+)/g)].map((m) => m[1]);
  const source = readApiSource();
  return enumNames.map((name) => {
    const v = source.match(new RegExp(`${name} = '([a-z_]+)'`));
    if (!v) throw new Error(`Enum qiymati topilmadi: ${name}`);
    return v[1];
  });
}

describe('profil turlari backend bilan mos', () => {
  it("frontend ro'yxati backend enum bilan aynan bir xil", () => {
    expect([...PROFILE_TYPES.map((t) => t.key)].sort()).toEqual([...apiProfileTypes()].sort());
  });

  it('tashkilot turlari backend bilan bir xil', () => {
    expect([...ORGANIZATION_TYPES].sort()).toEqual([...apiOrganizationTypes()].sort());
  });
});

describe('profileTypeMeta', () => {
  it('har bir tur uchun to\'liq ma\'lumot beradi', () => {
    for (const t of PROFILE_TYPES) {
      const meta = profileTypeMeta(t.key);
      expect(meta.label).toBeTruthy();
      expect(meta.shortLabel).toBeTruthy();
      expect(meta.nameLabel).toBeTruthy();
    }
  });

  // 🔴 NOMA'LUM TUR SAHIFANI QULATMASLIGI KERAK. Server yangi tur
  // qo'shib, frontend hali yozilmagan bo'lsa — kalitning o'zi
  // ko'rsatiladi, `undefined.label` emas.
  it("noma'lum turda ham xavfsiz qiymat qaytaradi", () => {
    const meta = profileTypeMeta('yangi_tur' as ProfileType);
    expect(meta.key).toBe('yangi_tur');
    expect(meta.label).toBe('yangi_tur');
    expect(meta.nameLabel).toBe('Nomi');
  });
});

describe('isOrganizationType', () => {
  it('tashkilot turlarini taniydi', () => {
    expect(isOrganizationType('company')).toBe(true);
    expect(isOrganizationType('travel_agent')).toBe(true);
    expect(isOrganizationType('source')).toBe(true);
  });

  // 🔴 GURUH TASHKILOT EMAS. Guruhda STIR/manzil maydonlari yo'q
  // (backend `FIELD_ALLOWED_TYPES` shuni talab qiladi) — agar bu yerda
  // `true` qaytsa, forma o'sha maydonlarni ko'rsatadi va saqlashda 400 keladi.
  it('mehmon, guruh va kontakt tashkilot emas', () => {
    expect(isOrganizationType('guest')).toBe(false);
    expect(isOrganizationType('group')).toBe(false);
    expect(isOrganizationType('contact')).toBe(false);
  });
});
