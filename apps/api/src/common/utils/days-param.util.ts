// Hisobotlarda (reports) qaytarilayotgan davr uzunligini belgilaydigan
// `?days=` query-parametrini tahlil qiluvchi umumiy yordamchi.
//
// Avval bu mantiq `reports.controller.ts`da 3 marta (har bir endpoint uchun
// alohida) bir xil ko'rinishda nusxalangan edi — polish auditida Medium
// darajali kod-sifat topilmasi sifatida qayd etilgan. Xatti-harakat aynan
// saqlanadi: `days` berilmasa yoki noto'g'ri (0, manfiy, NaN) bo'lsa
// `defaultDays`ga qaytadi, aks holda `maxDays` bilan yuqoridan cheklanadi.

export function parseDaysParam(
  days: string | undefined,
  defaultDays = 30,
  maxDays = 365,
): number {
  const parsed = days ? parseInt(days, 10) : defaultDays;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, maxDays)
    : defaultDays;
}
