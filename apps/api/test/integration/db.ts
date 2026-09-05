import { DataSource } from 'typeorm';
import { AppDataSource } from '../../src/database/data-source';

// 🔬 INTEGRATSION TESTLAR — BAZA YORDAMCHISI (2026-09-05).
//
// NIMA UCHUN BU KERAK EDI.
// Repozitoriyda 955 ta test bor va ULARNING HAMMASI mock bilan ishlaydi.
// Bu 2026-09-05 da uch marta o'zini ko'rsatdi — har safar nuqson faqat
// JONLI muhitda topildi, testlar esa yashil turaverdi:
//
//   1. `INSERT ... RETURNING` + RLS. Xato jurnaliga yozish production'da
//      "new row violates row-level security policy" bilan yiqilardi:
//      PostgreSQL `RETURNING` uchun yangi qatorni O'QISH huquqini ham
//      talab qiladi. Unit testda repository mock edi — SQL umuman
//      bajarilmagan, ya'ni test bu holatni printsipial ravishda ko'ra
//      olmasdi.
//   2. `pg_wrapper` — paket o'rnatilgani holda `pg_dump` eski versiyani
//      tanlagani.
//   3. Rate limiting — sozlama to'g'ri, lekin haqiqiy so'rovlarda emas.
//
// Mock'lar tez va foydali, lekin ular BIR NARSANI printsipial ravishda
// tekshira olmaydi: kodning BAZA bilan kelishuvi. RLS siyosatlari,
// GRANT'lar, tranzaksiya chegaralari, migratsiya holati — bularning
// hammasi mock ortida ko'rinmaydi.
//
// PRODUCTION KABI ULANISH. Bu yerdagi eng muhim tafsilot: ilova
// jadvallarning EGASI BO'LMAGAN rol (`hotel_saas_app`) bilan ulanadi.
// PostgreSQL jadval egasiga RLS'ni qo'llamaydi, ya'ni ega roli bilan
// ulangan test izolyatsiya buzilganini KO'RMASDI va bizga yolg'on
// xotirjamlik berardi. Migratsiyalar esa aksincha — ega roli bilan
// ishlaydi (ular RLS ostida bo'lsa 0 qatorga ta'sir qilardi).
//
// VERSIYA. Production'da PostgreSQL 18. CI'da ham 18 (`postgres:18`
// servisi). Lokal ishlab chiqishda 16 bo'lishi mumkin — RLS semantikasi
// bu versiyalar orasida o'zgarmagan, lekin haqiqiy hakam CI.

export interface TestDbConfig {
  host: string;
  port: number;
  ownerUser: string;
  ownerPassword: string;
  appUser: string;
  appPassword: string;
  database: string;
}

export function testDbConfig(): TestDbConfig {
  return {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: Number(process.env.TEST_DB_PORT) || 5432,
    ownerUser: process.env.TEST_DB_USERNAME || 'hotel_saas',
    ownerPassword: process.env.TEST_DB_PASSWORD || 'hotel_saas_dev',
    appUser: process.env.TEST_DB_APP_USERNAME || 'hotel_saas_app',
    appPassword: process.env.TEST_DB_APP_PASSWORD || 'hotel_saas_app_dev',
    database: process.env.TEST_DB_NAME || 'hotel_saas_test',
  };
}

/**
 * Migratsiyalarni ishlatadi (EGA roli bilan) va migratsiya
 * DataSource'ini qaytaradi.
 *
 * Migratsiyalar ATAYLAB har ishga tushirishda bajariladi: ular
 * idempotent va shu bilan test bazasi har doim eng oxirgi sxemada
 * bo'ladi. Bu qo'shimcha foyda ham beradi — yangi migratsiya
 * yozilganda u shu yerda HAQIQATAN ishga tushadi va sintaktik yoki
 * huquq xatosi darhol ko'rinadi.
 */
export async function runMigrations(): Promise<DataSource> {
  const cfg = testDbConfig();
  const ds = AppDataSource.setOptions({
    host: cfg.host,
    port: cfg.port,
    username: cfg.ownerUser,
    password: cfg.ownerPassword,
    database: cfg.database,
    ssl: false,
    logging: false,
  });
  if (!ds.isInitialized) await ds.initialize();
  await ds.runMigrations();
  return ds;
}

/**
 * Testlar orasida ma'lumotlarni tozalaydi.
 *
 * `TRUNCATE ... CASCADE` — EGA roli bilan, chunki RLS ostidagi rol
 * faqat o'z tenantining qatorlarini o'chira olardi va begona qator
 * qolib ketardi (aynan shu jimgina iflosl anish testlararo "sirli"
 * yiqilishlarga olib keladi).
 *
 * 🔴 IKKI JADVAL ATAYLAB TEGILMAYDI (`KEEP` ro'yxati):
 *
 *   `migrations`  — aks holda har testdan keyin butun sxema qayta
 *                   qurilishi kerak bo'lardi.
 *   `permissions` — bu tenant ma'lumoti EMAS, statik katalog. Uni
 *                   migratsiya to'ldiradi (2026-09-05,
 *                   SeedPermissionCatalogue), ya'ni tozalansa QAYTA
 *                   TIKLANMAYDI: migratsiya allaqachon "bajarilgan"
 *                   deb yozilgan. Natijada keyingi testda tenant
 *                   ro'yxatdan o'ta olmasdi. Bu tuzoqqa bir marta
 *                   tushilgan, shuning uchun bu yerda izohlangan.
 */
const KEEP: readonly string[] = ['migrations', 'permissions'];

export async function truncateAll(ds: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await ds.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> ALL($1)`,
    [KEEP],
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await ds.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
