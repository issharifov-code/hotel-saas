import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M10). Butun tizimda parol
// siyosati yagona `@MinLength(8)` edi — ya'ni `12345678`, `password`,
// `qwertyui` yoki mehmonxona nomining o'zi ham qabul qilinardi. Bu
// alohida olganda past xavf, lekin u OG'IR oqibatli qatlamni himoya
// qiladi: tenant EGASINING paroli (`register-tenant`) — o'sha hisob
// butun mehmonxona ma'lumotiga, moliyaga va xodimlarga to'liq kirish
// beradi. Rate limiting (`AppThrottlerGuard`) onlayn tanlashni
// sekinlashtiradi, ammo "eng ommabop 20 ta parol" ro'yxati bilan
// urinish baribir o'tib ketishi mumkin edi.
//
// Nima uchun murakkab "har xil belgi turi" qoidasi EMAS: majburiy
// maxsus belgi + bosh harf qoidalari amalda `Parol123!` kabi
// bashoratli naqshlarga olib keladi (NIST SP 800-63B ham aynan shu
// sababdan kompozitsiya qoidalarini tavsiya qilmaydi). Shuning uchun:
//   * uzunlik oshirildi (8 -> 10),
//   * kamida ikki xil belgi sinfi (harf + raqam/belgi) talab qilinadi,
//   * eng ko'p uchraydigan/aniq zaif parollar to'g'ridan-to'g'ri
//     rad etiladi,
//   * takrorlanuvchi (`aaaaaaaaaa`) va ketma-ket (`12345678`,
//     `qwertyui`) naqshlar rad etiladi.
//
// Bu qoida FAQAT yangi parol o'rnatishda qo'llaniladi. Mavjud
// foydalanuvchilar login qila oladi (login DTO'sida bu validator yo'q),
// aks holda tuzatish barcha eski hisoblarni bloklab qo'yardi.

export const MIN_PASSWORD_LENGTH = 10;

// Kichik, ataylab qisqa ro'yxat: to'liq "10 million parol" lug'atini
// bu yerda saqlashning ma'nosi yo'q (u o'z xizmatini talab qiladi).
// Maqsad — eng ko'p uchraydigan va lokal kontekstga xos variantlar.
const BANNED_PASSWORDS = new Set(
  [
    'password',
    'password1',
    'password123',
    'passw0rd',
    'parol123',
    'parol1234',
    'qwerty123',
    'qwertyuiop',
    '1234567890',
    '123456789',
    '12345678',
    '111111111',
    'iloveyou',
    'admin123',
    'admin1234',
    'administrator',
    'welcome123',
    'changeme123',
    'letmein123',
    'hotel1234',
    'hotel123456',
    'mehmonxona',
    'mehmonxona123',
    'folioone',
    'folioone123',
    'usali123',
    'usali1234',
  ].map((s) => s.toLowerCase()),
);

const KEYBOARD_RUNS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
];

/** Klaviatura/alifbo ketma-ketligidan 6+ belgi ketma-ket kelganini topadi. */
function hasSequentialRun(value: string): boolean {
  const lower = value.toLowerCase();
  for (const run of KEYBOARD_RUNS) {
    const reversed = [...run].reverse().join('');
    for (const source of [run, reversed]) {
      for (let i = 0; i + 6 <= source.length; i++) {
        if (lower.includes(source.slice(i, i + 6))) return true;
      }
    }
  }
  return false;
}

export interface PasswordStrengthResult {
  ok: boolean;
  message?: string;
}

/**
 * Sof funksiya — validator dekoratoridan alohida sinaladi.
 */
export function checkPasswordStrength(value: unknown): PasswordStrengthResult {
  if (typeof value !== 'string') {
    return { ok: false, message: "Parol matn bo'lishi kerak" };
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak`,
    };
  }
  if (value.length > 128) {
    // bcrypt 72 baytdan keyingisini e'tiborsiz qoldiradi; bundan tashqari
    // juda uzun kirish hash qilishda keraksiz yuk (DoS).
    return { ok: false, message: 'Parol 128 belgidan oshmasligi kerak' };
  }
  if (value.trim().length !== value.length) {
    return {
      ok: false,
      message: "Parol boshida yoki oxirida bo'sh joy bo'lmasligi kerak",
    };
  }

  const hasLetter = /[a-zA-ZЀ-ӿ]/.test(value);
  const hasNonLetter = /[^a-zA-ZЀ-ӿ]/.test(value);
  if (!hasLetter || !hasNonLetter) {
    return {
      ok: false,
      message:
        "Parolda kamida bitta harf va bitta raqam (yoki maxsus belgi) bo'lishi kerak",
    };
  }

  const lower = value.toLowerCase();
  if (BANNED_PASSWORDS.has(lower)) {
    return {
      ok: false,
      message: "Bu parol juda ko'p ishlatiladi — boshqasini tanlang",
    };
  }
  // Raqamlarni olib tashlagandagi asos ham taqiqlangan bo'lsa
  // (`password2026`, `admin1999`) — u ham rad etiladi.
  const stripped = lower.replace(/[0-9!@#$%^&*_.-]+$/g, '');
  if (stripped.length >= 5 && BANNED_PASSWORDS.has(stripped)) {
    return {
      ok: false,
      message: "Bu parol juda ko'p ishlatiladi — boshqasini tanlang",
    };
  }

  if (/^(.)\1+$/.test(value)) {
    return {
      ok: false,
      message: "Parol bir xil belgining takroridan iborat bo'lmasligi kerak",
    };
  }
  if (hasSequentialRun(value)) {
    return {
      ok: false,
      message:
        "Parolda klaviatura ketma-ketligi (masalan `qwerty`, `123456`) bo'lmasligi kerak",
    };
  }

  return { ok: true };
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return checkPasswordStrength(value).ok;
        },
        defaultMessage(args: ValidationArguments) {
          return (
            checkPasswordStrength(args.value).message ??
            'Parol yetarlicha kuchli emas'
          );
        },
      },
    });
  };
}
