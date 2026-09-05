// Platforma super-admin kredensiallarini muhit o'zgaruvchilaridan o'qish.
//
// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Critical). Ilgari `seed.ts` ichida:
//
//     const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@sizningsaas.uz';
//     const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe123!';
//
// Seed Render'da `buildCommand` ichida HAR DEPLOY'da ishlaydi, bu ikki
// o'zgaruvchi esa `sync: false` — ya'ni dashboard'da qo'lda kiritilmagan
// bo'lsa, repo'da turgan MA'LUM parol bilan `is_platform_admin = true`
// hisob yaratilardi. Login subdomainsiz va (o'sha paytda) rate-limitsiz
// ishlagani uchun repo'ni ko'rgan har kim barcha tenantlarga kira olardi.
//
// Bu mantiq `seed.ts` dan ATAYLAB ajratilgan: seed fayli import qilinishi
// bilan `run()` ni ishga tushiradi, ya'ni uni testda import qilib bo'lmaydi.
// Xavfsizlik qoidalari esa aynan sinovdan o'tishi kerak bo'lgan qism.

// Ilgari repo'da turgan parol. U git tarixida va Render build loglarida
// qolgan — kimdir uni o'zgaruvchiga qayta kiritib qo'ymasligi uchun aniq
// rad etamiz.
export const LEAKED_PASSWORDS = new Set(['ChangeMe123!', 'changeme123!']);

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export interface PlatformAdminCredentials {
  email: string;
  password: string;
}

/**
 * `null` qaytaradi — dev muhitida o'zgaruvchilar yo'q bo'lsa (admin
 * yaratilmaydi). Production'da yo'q bo'lsa ATAYLAB xato tashlaydi:
 * standart parol bilan admin yaratish endi mumkin emas.
 */
export function readPlatformAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): PlatformAdminCredentials | null {
  const isProduction = env.NODE_ENV === 'production';
  const rawEmail = env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = env.PLATFORM_ADMIN_PASSWORD;

  if (!rawEmail || !password) {
    if (isProduction) {
      throw new Error(
        'PLATFORM_ADMIN_EMAIL va PLATFORM_ADMIN_PASSWORD production muhitida majburiy. ' +
          "Render dashboard'da o'rnating (standart parol bilan admin yaratish endi mumkin emas).",
      );
    }
    return null;
  }

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `PLATFORM_ADMIN_PASSWORD kamida ${MIN_ADMIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak.`,
    );
  }
  if (LEAKED_PASSWORDS.has(password)) {
    throw new Error(
      "PLATFORM_ADMIN_PASSWORD sifatida eski standart parol ishlatilgan — u repo tarixida va build loglarida bor, boshqa parol tanlang.",
    );
  }

  // `UsersService` emailni har doim kichik harfga keltiradi va login ham
  // shunday qidiradi — bu yerda ham bir xil bo'lmasa, yaratilgan hisobga
  // hech qachon kirib bo'lmaydi.
  return { email: rawEmail.toLowerCase(), password };
}
