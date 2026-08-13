export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'hotel_saas',
    password: process.env.DB_PASSWORD || 'hotel_saas_dev',
    name: process.env.DB_NAME || 'hotel_saas_dev',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    // Soniyalarda (default: 8 soat) — @nestjs/jwt'ning StringValue tipidagi
    // qat'iy talablaridan qochish uchun son sifatida saqlanadi.
    expiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '28800', 10),
  },
});
