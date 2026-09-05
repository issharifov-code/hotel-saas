import { describe, expect, it } from 'vitest';
import { addDays, dateRange, formatDayLabel, isSameOrAfter, toISODate } from './dates';

// 🔬 SANA YORDAMCHILARI (2026-09-05).
//
// NIMA UCHUN BU MUHIM. Butun taxta (rooms grid), bron oynalari va
// tungi audit ko'rinishlari shu to'rt funksiyaga tayanadi. Ular
// ATAYLAB mahalliy `Date` bilan ishlaydi va hech qachon UTC'ga
// o'tmaydi: mehmonxona uchun "5-sentabr" — bu mehmonxonaning
// kunidir, Grinvichniki emas. `new Date('2026-09-05')` esa UTC yarim
// tunni beradi va UTC+5 da ham to'g'ri ko'rinadi, lekin manfiy
// mintaqalarda BIR KUN ORQAGA suriladi. Shu sabab bu yerda hamma
// joyda satr `y-m-d` ga bo'linadi.
//
// Testlar aynan shu xossalarni qo'riqlaydi: chegaralardan o'tish
// (oy, yil, kabisa) va satr formatining qat'iyligi (nol bilan
// to'ldirish — aks holda '2026-9-5' backend bilan mos kelmaydi).

describe('toISODate', () => {
  it("bir xonali oy va kunni nol bilan to'ldiradi", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('ikki xonali qiymatlarni o\'zgartirmaydi', () => {
    expect(toISODate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  // 🔴 MAHALLIY VAQT, UTC EMAS. Kun oxiridagi vaqt ham o'sha kunga
  // tegishli bo'lishi kerak — UTC'ga o'tsa manfiy mintaqalarda
  // ertangi kunga sirg'anardi.
  it('kun oxiridagi vaqt ham o\'sha kunni beradi', () => {
    expect(toISODate(new Date(2026, 8, 5, 23, 59, 59))).toBe('2026-09-05');
  });
});

describe('addDays', () => {
  it("oddiy holatda kunni qo'shadi", () => {
    expect(addDays('2026-09-05', 3)).toBe('2026-09-08');
  });

  it('oy chegarasidan o\'tadi', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });

  it('yil chegarasidan o\'tadi', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('orqaga ham hisoblaydi', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  // Kabisa yili: 2028 — 29-fevral bor.
  it('kabisa yilida 29-fevralni to\'g\'ri beradi', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('kabisa bo\'lmagan yilda 28-fevraldan keyin mart keladi', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('nol kun qo\'shilsa sana o\'zgarmaydi', () => {
    expect(addDays('2026-09-05', 0)).toBe('2026-09-05');
  });
});

describe('dateRange', () => {
  it('boshlanish sanasidan boshlab ketma-ket kunlarni beradi', () => {
    expect(dateRange('2026-09-05', 3)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07']);
  });

  it("nol uzunlikda bo'sh ro'yxat qaytaradi", () => {
    expect(dateRange('2026-09-05', 0)).toEqual([]);
  });

  it('oy chegarasi orqali ham uzluksiz davom etadi', () => {
    expect(dateRange('2026-08-30', 3)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });
});

describe('formatDayLabel', () => {
  it('hafta kunini va kun/oyni beradi', () => {
    // 2026-09-05 — shanba.
    expect(formatDayLabel('2026-09-05')).toEqual({ weekday: 'Shan', dayMonth: '5 Sen' });
  });

  it('yakshanba ro\'yxatning boshidan olinadi', () => {
    // 2026-09-06 — yakshanba (`getDay() === 0`).
    expect(formatDayLabel('2026-09-06').weekday).toBe('Yak');
  });

  it('yanvar birinchi oy sifatida ko\'rsatiladi', () => {
    expect(formatDayLabel('2026-01-15').dayMonth).toBe('15 Yan');
  });

  it('dekabr oxirgi oy sifatida ko\'rsatiladi', () => {
    expect(formatDayLabel('2026-12-31').dayMonth).toBe('31 Dek');
  });
});

describe('isSameOrAfter', () => {
  it('bir xil sanalar uchun rost', () => {
    expect(isSameOrAfter('2026-09-05', '2026-09-05')).toBe(true);
  });

  it('keyingi sana uchun rost', () => {
    expect(isSameOrAfter('2026-09-06', '2026-09-05')).toBe(true);
  });

  it('oldingi sana uchun yolg\'on', () => {
    expect(isSameOrAfter('2026-09-04', '2026-09-05')).toBe(false);
  });

  // Satrli solishtirish faqat NOL BILAN TO'LDIRILGAN formatda to'g'ri
  // ishlaydi — shu sabab `toISODate` dagi `padStart` shart.
  it('yil chegarasida ham to\'g\'ri ishlaydi', () => {
    expect(isSameOrAfter('2027-01-01', '2026-12-31')).toBe(true);
    expect(isSameOrAfter('2026-12-31', '2027-01-01')).toBe(false);
  });
});
