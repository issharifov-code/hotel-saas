import { LoyaltyTier } from './entities/guest.entity';

// LoyaltyService'dan ajratib olingan SOF (DB'ga bog'liq bo'lmagan) formulalar —
// SampleDataService (namunaviy ma'lumot generatsiyasi) ham xuddi shu hisob-kitobdan
// foydalanishi kerak (RLS-himoyalangan repository'larsiz, faqat funksiya sifatida),
// shuning uchun LoyaltyService'ning o'zidan emas, shu alohida faylchadan import qilinadi.

// Daraja bo'sag'alari — `lifetimePoints` (umr bo'yi to'plangan, hech qachon kamaymaydigan)
// asosida. Eng yuqoridan pastga tekshiriladi. Kelajakda tenant-sozlanadigan qilish mumkin,
// hozircha butun platforma uchun bitta standart.
export const TIER_THRESHOLDS: Array<[LoyaltyTier, number]> = [
  [LoyaltyTier.PLATINUM, 15000],
  [LoyaltyTier.GOLD, 5000],
  [LoyaltyTier.SILVER, 1000],
  [LoyaltyTier.BRONZE, 0],
];

// 1 ball = 10 valyuta birligi (to'lov summasi asosida) — sodda, tenant-sozlanadigan
// bo'lishi kelajakda mumkin (hozircha butun platforma uchun bitta qoida).
export const POINTS_PER_CURRENCY_UNIT = 0.1;

export function calculateLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  for (const [tier, threshold] of TIER_THRESHOLDS) {
    if (lifetimePoints >= threshold) return tier;
  }
  return LoyaltyTier.BRONZE;
}

export function pointsForPayment(amount: string | number): number {
  return Math.floor(Number(amount) * POINTS_PER_CURRENCY_UNIT);
}
