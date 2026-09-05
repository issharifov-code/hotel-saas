import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Har testdan keyin DOM tozalanadi — aks holda oldingi testning
// render qilingan daraxti keyingisida ham topilib, "nega ikkita
// element bor?" degan sirli yiqilishlarga olib kelardi.
afterEach(() => {
  cleanup();
});

// 🔴 `matchMedia` — jsdom uni umuman qo'llab-quvvatlamaydi (brauzerdagi
// haqiqiy tartib-tarkib hisobi u yerda yo'q). AppLayout esa undan
// foydalanadi: panel keng ekranda kontentni surib ochiladi, tor ekranda
// esa ustiga tushadi, va buni CSS bilan qilib bo'lmagani uchun JS
// kuzatadi.
//
// Standart javob: `matches: false` — ya'ni TOR ekran. Bu ataylab:
// tor ekranda menyu ELEMENTLARI to'liq ko'rinadi (keng ekranda ularning
// bir qismi yuqoridagi gorizontal panelga ko'chadi), ya'ni ruxsat
// testlari uchun to'g'ri boshlang'ich holat.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
