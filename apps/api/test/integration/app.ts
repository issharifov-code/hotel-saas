import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { testDbConfig } from './db';
import {
  assertRlsRuntimeRole,
  inspectRlsRuntimeRole,
} from '../../src/common/rls/assert-rls-runtime-role';

// 🔬 TEST ILOVASI (2026-09-05).
//
// Bu yerda ilova PRODUCTION'DAGI BILAN BIR XIL sozlanadi: global prefiks,
// ValidationPipe'ning aynan o'sha bayroqlari, va eng muhimi — RLS ostidagi
// ulanish roli.
//
// NEGA `main.ts` ni chaqirmaymiz. U `app.listen()` qiladi va port band
// qiladi; testlarga esa HTTP server kerak emas — `supertest` ilovaning
// ichki handler'iga to'g'ridan-to'g'ri murojaat qiladi. Shuning uchun
// sozlamalar shu yerda TAKRORLANADI. Bu takrorlanish o'zi ham xavf: agar
// `main.ts` da yangi global sozlama paydo bo'lsa va bu yerga
// ko'chirilmasa, test production'dan boshqacha ilovani sinardi. Shuning
// uchun quyida faqat XULQQA TA'SIR QILADIGANLARI bor va har biri
// izohlangan; helmet/CORS ataylab yo'q (ular HTTP sarlavhalari, biznes
// mantiqqa tegmaydi).

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  http: () => request.Agent;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const cfg = testDbConfig();

  // Konfiguratsiya `ConfigModule` orqali o'qiladi, ya'ni env
  // o'zgaruvchilarini AppModule qurilishidan OLDIN qo'yish kerak.
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = cfg.host;
  process.env.DB_PORT = String(cfg.port);
  process.env.DB_NAME = cfg.database;
  process.env.DB_USERNAME = cfg.ownerUser;
  process.env.DB_PASSWORD = cfg.ownerPassword;
  // 🔴 ENG MUHIM QATOR. Ilova jadvallarning EGASI BO'LMAGAN rol bilan
  // ulanadi — PostgreSQL egaga RLS qo'llamaydi. Bu yerda ega roli
  // ishlatilsa, izolyatsiya testlari BUZILGAN kodda ham yashil bo'lardi.
  process.env.DB_APP_USERNAME = cfg.appUser;
  process.env.DB_APP_PASSWORD = cfg.appPassword;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
  // Ogohlantirish testlarda tarmoqqa chiqmasin.
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  // `AppModule` ni kech yuklaymiz — yuqoridagi env qiymatlari
  // o'rnatilgandan KEYIN, aks holda `ConfigModule` va `data-source.ts`
  // eski (yoki bo'sh) qiymatlarni o'qib qolardi.
  //
  // `import()` EMAS, `require()`: ts-jest kodni CommonJS'ga o'giradi va
  // dinamik `import()` u yerda haqiqiy ESM import bo'lib qoladi —
  // "A dynamic import callback was invoked without --experimental-vm-modules"
  // xatosi aynan shundan chiqadi.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../../src/app.module') as {
    AppModule: unknown;
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule as never],
  }).compile();

  const app = moduleRef.createNestApplication();

  // `main.ts` dagi bilan bir xil — DTO validatsiyasi test qilinayotgan
  // xulqning bir qismi (masalan `forbidNonWhitelisted` ortiqcha maydonni
  // rad etadi).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();

  const dataSource = app.get(DataSource);

  // 🔴 Production'dagi ishga tushish tekshiruvi shu yerda ham bajariladi.
  // Sababi oddiy: agar test bazasi noto'g'ri sozlangan bo'lsa (ilova ega
  // roli bilan ulangan), quyidagi izolyatsiya testlari YASHIL bo'lardi va
  // biz himoya ishlayapti deb o'ylardik. Bu — testning o'ziga qo'yilgan
  // qo'riqchi.
  assertRlsRuntimeRole(await inspectRlsRuntimeRole(dataSource));

  return {
    app,
    dataSource,
    http: () => request(app.getHttpServer() as App),
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Yangi tenant ro'yxatdan o'tkazadi va tokenini qaytaradi.
 *
 * ATAYLAB haqiqiy `POST /api/auth/register-tenant` yo'lidan boradi:
 * bu yo'l tenant, standart mulk, 6 ta rol va namunaviy ma'lumotni
 * yaratadi — ya'ni test ma'lumoti ilovaning o'zi yaratganidek bo'ladi,
 * qo'lda `INSERT` bilan qurilgan sun'iy holat emas.
 *
 * 🔴 DIQQAT — CHEGARA. Bu yo'l soatiga 3 ta bilan cheklangan
 * (`@Throttle`, 2026-09-05 xavfsizlik auditi). Chegara xotirada va ilova
 * nusxasiga bog'liq, ya'ni har `createTestApp()` uni nolga qaytaradi.
 * Bitta test faylida 3 tadan ko'p ro'yxatdan o'tkazish kerak bo'lsa,
 * ilovani qayta ko'tarish kerak.
 */
export async function registerTenant(
  t: TestApp,
  opts: { subdomain: string; email: string; name?: string },
): Promise<{ token: string; tenantId: string; userId: string }> {
  const res = await t
    .http()
    .post('/api/auth/register-tenant')
    .send({
      tenantName: opts.name ?? `Mehmonxona ${opts.subdomain}`,
      subdomain: opts.subdomain,
      ownerEmail: opts.email,
      // Parol siyosati (2026-09-05, M10): kamida 10 belgi, oddiy
      // parollar va klaviatura ketma-ketligi rad etiladi.
      ownerPassword: 'Integratsiya!2026',
      ownerFullName: 'Test Egasi',
    })
    .expect(201);

  const body = res.body as {
    accessToken: string;
    user: { id: string; tenantId: string };
  };
  return {
    token: body.accessToken,
    tenantId: body.user.tenantId,
    userId: body.user.id,
  };
}
