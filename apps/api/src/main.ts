import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment o'zgaruvchisi production muhitida majburiy (standart qiymat bilan ishga tushirish xavfsiz emas).",
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05). Render API'ni teskari proksi ortida
  // ishga tushiradi, ya'ni `req.ip` proksi manzili bo'ladi. Buni to'g'rilamasak
  // rate limiting BARCHA foydalanuvchilarni bitta IP deb hisoblab, hammani
  // birdaniga bloklab qo'yardi.
  //
  // `1` — faqat ENG YAQIN proksiga ishonish (Render'ning o'zi). Cheksiz
  // ishonch (`true`) mijozga `X-Forwarded-For` ni soxtalashtirib rate
  // limitingni chetlab o'tish imkonini berardi.
  app.set('trust proxy', 1);

  // Xavfsizlik sarlavhalari (auditning M4 topilmasi): nosniff, frameguard,
  // referrer-policy, HSTS va h.k. CSP bu yerda o'chirilgan — API JSON
  // qaytaradi, HTML emas; CSP statik sayt tomonida (render.yaml) beriladi.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Express'ning standart JSON body chegarasi 100KB. Mehmonxona logotipi
  // bazada `data:` URL (base64) sifatida saqlanadi va 100KB'dan oshishi
  // mumkin, shuning uchun chegara 1MB'ga ko'tarildi. DTO darajasida logotip
  // uchun aniqroq chegara bor (LOGO_MAX_LENGTH ~400KB), ya'ni bu global
  // qiymat faqat so'rovning DTO'gacha yetib borishini ta'minlaydi.
  app.useBodyParser('json', { limit: '1mb' });

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low). Ilgari `CORS_ORIGIN` bo'sh
  // bo'lsa `origin: true` ishlatilardi — ya'ni `credentials: true` bilan
  // birga INTERNETDAGI HAR QANDAY origin ruxsat olardi, hech qanday log
  // yoki xatosiz. Bu fail-OPEN standart edi.
  //
  // Endi production'da ro'yxat majburiy (JWT_SECRET bilan bir xil naqsh);
  // cheklovsiz rejim faqat dev/Codespace uchun qoladi.
  const allowedOrigins = config.get<string[]>('corsOrigins') ?? [];
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGIN environment o'zgaruvchisi production muhitida majburiy (bo'sh qoldirilsa har qanday origin'ga ruxsat berilgan bo'lardi).",
    );
  }
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da yo'q maydonlarni tashlab yuboradi
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API ${port}-portda ishga tushdi (http://localhost:${port}/api)`);
}
bootstrap();
