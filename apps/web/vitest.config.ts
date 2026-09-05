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
// 🔴 JSDOM VERSIYASI NODE 20 GA BOG'LIQ (2026-09-05, CI'da topildi).
//
// Birinchi urinishda jsdom 30 o'rnatilgan edi va lokal muhitda (Node
// 22) hammasi yashil edi. CI esa Node 20 da ishlaydi va u yerda
// to'plam butunlay yiqildi:
//
//     TypeError: webidl.util.markAsUncloneable is not a function
//
// Sabab: jsdom 30 `engines` da Node >= 22.22.2 talab qiladi va
// undici'ning faqat yangi Node'da bor funksiyasidan foydalanadi.
//
// YECHIM — jsdom'ni tushirish, CI'ni ko'tarish EMAS. Repozitoriyning
// Node "poli" 20 (`package.json` -> engines) va API build'i ham
// o'sha versiyada sinalgan. Test kutubxonasi uchun butun quvurni
// yangi Node'ga ko'chirish teskari mantiq bo'lardi: quyruq itni
// silkitardi.
//
// XULOSA: `apps/web` ning test bog'liqliklari Node 20 ni
// qo'llab-quvvatlashi SHART. Bu yana o'sha saboq — muhitlar
// orasidagi farq nuqsonni yashiradi, va uni faqat haqiqiy CI ochadi.

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
