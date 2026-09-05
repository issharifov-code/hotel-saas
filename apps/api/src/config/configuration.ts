// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M9). Ilgari har bir sir
// uchun hardcoded fallback bor edi:
//
//   password: process.env.DB_PASSWORD || 'hotel_saas_dev',
//   secret:   process.env.JWT_SECRET  || 'change-me-in-production',
//
// `JWT_SECRET` uchun `main.ts` da production-guard bor edi, ya'ni amalda
// xavfsiz — LEKIN xavfsizlik `NODE_ENV === 'production'` ning har doim
// va hamma joyda to'g'ri o'rnatilishiga bog'liq edi. Staging, Render
// preview muhiti yoki `NODE_ENV`siz bir martalik `node dist/...` ishi
// jimgina MA'LUM kalitni olardi — va o'sha kalit bilan imzolangan
// tokenlar haqiqiy ma'lumotli bazaga qarshi ishlayverardi.
//
// Endi standart qiymatlar faqat DEV uchun va aniq ajratilgan. Production
// muhitida sir yo'q bo'lsa — `requireInProduction` qattiq yiqiladi,
// `NODE_ENV` ni to'g'ri o'rnatish esa yagona shart bo'lib qoladi
// (u `render.yaml` da aniq berilgan).
const DEV_DEFAULTS = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'hotel_saas',
  DB_PASSWORD: 'hotel_saas_dev',
  DB_NAME: 'hotel_saas_dev',
  DB_APP_USERNAME: 'hotel_saas_app',
  DB_APP_PASSWORD: 'hotel_saas_app_dev',
  JWT_SECRET: 'change-me-in-production',
} as const;

type DevDefaultKey = keyof typeof DEV_DEFAULTS;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Production'da o'zgaruvchi majburiy; dev'da esa hujjatlashtirilgan
 * standart qiymat ishlatiladi.
 */
function requireInProduction(key: DevDefaultKey): string {
  const value = process.env[key];
  if (value) return value;
  if (isProduction()) {
    throw new Error(
      `${key} environment o'zgaruvchisi production muhitida majburiy — standart qiymat bilan ishga tushirish xavfsiz emas.`,
    );
  }
  return DEV_DEFAULTS[key];
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: requireInProduction('DB_HOST'),
    port: parseInt(process.env.DB_PORT || DEV_DEFAULTS.DB_PORT, 10),
    // Migratsiya/seed operatsiyalari uchun (jadval egasi, RLS'dan ta'sirlanmaydi).
    username: requireInProduction('DB_USERNAME'),
    password: requireInProduction('DB_PASSWORD'),
    name: requireInProduction('DB_NAME'),
    // Runtime ilova ulanishi uchun — jadval egasi EMAS, shuning uchun
    // Row-Level Security siyosatlari unga ham qo'llaniladi (himoya qatlami).
    // Rol EnableRowLevelSecurity migratsiyasi orqali yaratiladi.
    // `main.ts` ishga tushishda bu rol haqiqatan ega emasligini tekshiradi.
    appUsername: requireInProduction('DB_APP_USERNAME'),
    appPassword: requireInProduction('DB_APP_PASSWORD'),
    // Render/boshqa boshqariladigan Postgres xizmatlari odatda SSL talab qiladi.
    // Mahalliy Docker Postgres uchun standart holatda o'chirilgan.
    ssl: process.env.DB_SSL === 'true',
    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M8). Ilgari TLS har doim
    // `rejectUnauthorized: false` bilan ishlatilardi: ulanish SHIFRLANGAN,
    // lekin AUTENTIFIKATSIYASIZ — ya'ni ulanishni yo'naltira oladigan
    // tomon o'z sertifikatini ko'rsatib, barcha so'rovlarni (jumladan
    // kredensiallarni) o'qiy va o'zgartira olardi.
    //
    // Bu qiymatni shunchaki `true` qilib qo'yish ishlab chiqarishni
    // to'xtatib qo'yardi: Render'ning boshqariladigan Postgres'i o'z CA
    // sertifikatiga ega va u tizim ishonch do'konida bo'lmasligi mumkin.
    // Shuning uchun CA sozlanadigan qilindi: `DB_SSL_CA` berilsa TLS
    // TO'LIQ tekshiriladi, berilmasa avvalgi xatti-harakat saqlanadi va
    // `data-source.ts` production'da ogohlantirish yozadi.
    sslCa: process.env.DB_SSL_CA || null,
  },
  jwt: {
    secret: requireInProduction('JWT_SECRET'),
    // Soniyalarda (default: 8 soat) — @nestjs/jwt'ning StringValue tipidagi
    // qat'iy talablaridan qochish uchun son sifatida saqlanadi.
    expiresInSeconds: parseInt(
      process.env.JWT_EXPIRES_IN_SECONDS || '28800',
      10,
    ),
  },
  // Vergul bilan ajratilgan ruxsat etilgan origin'lar ro'yxati (production uchun,
  // masalan "https://usali.uz,https://www.usali.uz"). Production'da bo'sh
  // qoldirilsa `main.ts` ishga tushishni to'xtatadi (fail-open bo'lmasin).
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
