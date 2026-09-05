import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M10). Subdomain formati
// tekshirilardi (`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`), lekin
// MAZMUNI emas. Ya'ni ochiq ro'yxatdan o'tish orqali `www`, `api`,
// `admin`, `app` yoki `mail` kabi xizmat nomlarini olib qo'yish mumkin
// edi. Bu ikki xil zarar beradi:
//
//   1) Marshrutlash to'qnashuvi — `api.usali.uz` yoki `www.usali.uz`
//      bir kun tenant subdomain'lariga yo'naltirilsa, platformaning
//      o'z xizmatlari ustidan tenant nazorati paydo bo'ladi.
//   2) Fishing/ishonch — `admin.usali.uz` yoki `support.usali.uz`
//      begona tomonda bo'lsa, u rasmiy sahifadek ko'rinadi va
//      kredensial yig'ish uchun ishlatilishi mumkin.
//
// Ro'yxat ataylab keng: subdomain bepul resurs emas, uni keyinroq
// ochish oson, qaytarib olish esa (tenant allaqachon ishlatgan bo'lsa)
// juda qiyin.

export const RESERVED_SUBDOMAINS = new Set([
  // Platformaning o'z xostlari / marshrutlari
  'www',
  'api',
  'app',
  'admin',
  'administrator',
  'platform',
  'dashboard',
  'console',
  'portal',
  'account',
  'accounts',
  'auth',
  'login',
  'logout',
  'signup',
  'register',
  'billing',
  'payment',
  'payments',
  'checkout',
  'support',
  'help',
  'docs',
  'doc',
  'status',
  'blog',
  'news',
  'about',
  'contact',
  'demo',
  'pricing',
  'partners',
  'careers',
  // Muhit nomlari
  'dev',
  'test',
  'testing',
  'stage',
  'staging',
  'preview',
  'sandbox',
  'prod',
  'production',
  'local',
  'localhost',
  'internal',
  // Infratuzilma / pochta (SPF/DKIM va sertifikat jarayonlariga tegishli)
  'mail',
  'smtp',
  'imap',
  'pop',
  'pop3',
  'mx',
  'ns',
  'ns1',
  'ns2',
  'dns',
  'cdn',
  'static',
  'assets',
  'media',
  'files',
  'img',
  'images',
  'ftp',
  'ssh',
  'vpn',
  'proxy',
  'gateway',
  'webhook',
  'webhooks',
  'ws',
  'socket',
  'grafana',
  'metrics',
  'monitor',
  'monitoring',
  'backup',
  'db',
  'database',
  'redis',
  'storage',
  's3',
  // Sertifikat / domen tasdiqlash
  'autodiscover',
  'autoconfig',
  '_acme-challenge',
  'acme',
  'well-known',
  // Brend
  'folioone',
  'folio',
  'usali',
  'security',
  'abuse',
  'postmaster',
  'root',
  'system',
  'null',
  'undefined',
]);

export interface SubdomainCheckResult {
  ok: boolean;
  message?: string;
}

export function checkSubdomain(value: unknown): SubdomainCheckResult {
  if (typeof value !== 'string') {
    return { ok: false, message: "subdomain matn bo'lishi kerak" };
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    return {
      ok: false,
      message:
        "subdomain faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak",
    };
  }
  if (normalized.length < 3) {
    return {
      ok: false,
      message: "subdomain kamida 3 belgidan iborat bo'lishi kerak",
    };
  }
  if (normalized.includes('--')) {
    // `xn--` punycode prefiksi va unga o'xshash chalg'ituvchi nomlarni
    // (homograph hujumlari) oldini oladi.
    return {
      ok: false,
      message: "subdomain ichida ketma-ket ikkita tire (--) bo'lmasligi kerak",
    };
  }
  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return {
      ok: false,
      message: `"${normalized}" band qilingan xizmat nomi — boshqa subdomain tanlang`,
    };
  }
  return { ok: true };
}

export function IsAvailableSubdomain(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAvailableSubdomain',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return checkSubdomain(value).ok;
        },
        defaultMessage(args: ValidationArguments) {
          return checkSubdomain(args.value).message ?? 'subdomain yaroqsiz';
        },
      },
    });
  };
}
