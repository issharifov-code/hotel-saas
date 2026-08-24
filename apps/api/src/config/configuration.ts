export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    // Migratsiya/seed operatsiyalari uchun (jadval egasi, RLS'dan ta'sirlanmaydi).
    username: process.env.DB_USERNAME || 'hotel_saas',
    password: process.env.DB_PASSWORD || 'hotel_saas_dev',
    name: process.env.DB_NAME || 'hotel_saas_dev',
    // Runtime ilova ulanishi uchun — jadval egasi EMAS, shuning uchun
    // Row-Level Security siyosatlari unga ham qo'llaniladi (himoya qatlami).
    // Rol EnableRowLevelSecurity migratsiyasi orqali yaratiladi.
    appUsername: process.env.DB_APP_USERNAME || 'hotel_saas_app',
    appPassword: process.env.DB_APP_PASSWORD || 'hotel_saas_app_dev',
    // Render/boshqa boshqariladigan Postgres xizmatlari odatda SSL talab qiladi.
    // Mahalliy Docker Postgres uchun standart holatda o'chirilgan.
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    // Soniyalarda (default: 8 soat) — @nestjs/jwt'ning StringValue tipidagi
    // qat'iy talablaridan qochish uchun son sifatida saqlanadi.
    expiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '28800', 10),
  },
  // Vergul bilan ajratilgan ruxsat etilgan origin'lar ro'yxati (production uchun,
  // masalan "https://folioone.uz,https://www.folioone.uz"). Bo'sh bo'lsa — dev
  // rejimidagi kabi istalgan origin qabul qilinadi (Codespace/preview domenlari uchun).
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
