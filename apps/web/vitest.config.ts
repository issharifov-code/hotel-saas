import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 🔬 WEB TESTLARI (2026-09-05).
//
// NIMA UCHUN BU KERAK EDI. API tomonida 961 ta unit va 31 ta
// integratsion test bor edi, web tomonida esa NOLTA. Ya'ni
// foydalanuvchi ko'radigan hamma narsa — ruxsatga qarab nima
// ko'rinishi, xato xabari qanday chiqishi, tokenning qo'yilishi —
// hech narsa bilan qo'riqlanmagan edi.
//
// ALOHIDA KONFIGURATSIYA, `vite.config.ts` GA QO'SHIMCHA EMAS.
// Sabab: `vite.config.ts` da `tailwindcss()` plagini bor va u
// testlarda keraksiz (CSS umuman render qilinmaydi), lekin har bir
// test ishga tushganda butun CSS quvurini ishga soladi. Bu yerda
// faqat `react()` — testlar tez qoladi.
//
// `jsdom` — brauzer muhitini taqlid qiladi. Haqiqiy brauzer emas,
// ya'ni CSS bilan bog'liq narsalarni (masalan chiziq qayerda
// turishi) BU YERDA tekshirib bo'lmaydi — buning uchun Playwright
// kerak. Bu yerdagi vazifa boshqacha: MANTIQ (nima ko'rinadi, nima
// ko'rinmaydi, qanday so'rov ketadi).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // `src` ichidagi `*.test.ts(x)` fayllar. `dist` va `node_modules`
    // ataylab chiqarib tashlanadi.
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
