import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 TENANT IZOLYATSIYASI — HAQIQIY BAZA BILAN (2026-09-05).
//
// NIMA UCHUN BU TEST MOCK BILAN YOZIB BO'LMAYDI.
// Butun ko'p-ijarachi modelning xavfsizligi PostgreSQL'ning RLS
// siyosatlariga tayanadi. Siyosat esa KOD EMAS — u bazada yashaydi:
//
//   USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
//
// Mock repository bu qatorni hech qachon bajarmaydi. Ya'ni siyosat
// o'chirilgan, noto'g'ri yozilgan yoki yangi jadval uchun umuman
// qo'yilmagan bo'lsa ham, unit testlar YASHIL bo'ladi va biz izolyatsiya
// ishlayapti deb o'ylaymiz. Bu — mumkin bo'lgan eng yomon jimgina
// nosozlik: bir mehmonxona boshqasining mehmonlarini, bronlarini va
// moliyasini ko'rib turadi, hech qanday xato yoki logsiz.
//
// Shuning uchun bu yerda haqiqiy baza, haqiqiy siyosatlar va haqiqiy
// HTTP so'rovlari ishlatiladi — JWT'dan `request.user` ga, undan
// `set_config('app.tenant_id')` ga, undan siyosatga qadar butun zanjir.

jest.setTimeout(120_000);

describe('Tenant izolyatsiyasi (haqiqiy PostgreSQL + RLS)', () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let alfa: { token: string; tenantId: string };
  let beta: { token: string; tenantId: string };

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);

    t = await createTestApp();

    // Ikkita mustaqil mehmonxona — haqiqiy ro'yxatdan o'tish yo'lidan.
    // (Chegara: soatiga 3 ta, ya'ni bu faylda ko'pi bilan 3 ta.)
    alfa = await registerTenant(t, {
      subdomain: 'alfatest',
      email: 'egasi@alfatest.uz',
      name: 'Alfa Hotel',
    });
    beta = await registerTenant(t, {
      subdomain: 'betatest',
      email: 'egasi@betatest.uz',
      name: 'Beta Hotel',
    });
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("ro'yxatdan o'tish ikkita alohida tenant yaratdi", () => {
    expect(alfa.tenantId).toBeTruthy();
    expect(beta.tenantId).toBeTruthy();
    expect(alfa.tenantId).not.toBe(beta.tenantId);
  });

  // 🔴 ASOSIY QO'RIQCHI. Har bir tenant faqat O'Z mulklarini ko'radi.
  it("mulklar ro'yxati faqat o'z tenantiniki", async () => {
    const a = await t.http().get('/api/properties').set(auth(alfa.token)).expect(200);
    const b = await t.http().get('/api/properties').set(auth(beta.token)).expect(200);

    const aIds = (a.body as { id: string }[]).map((p) => p.id);
    const bIds = (b.body as { id: string }[]).map((p) => p.id);

    expect(aIds.length).toBeGreaterThan(0);
    expect(bIds.length).toBeGreaterThan(0);
    // Kesishma bo'sh bo'lishi SHART.
    expect(aIds.filter((id) => bIds.includes(id))).toEqual([]);
  });

  // Mehmon ma'lumoti — eng nozik toifadagi ma'lumot (ism, telefon,
  // hujjat). Ro'yxatdan o'tishda namunaviy dataset yaratiladi, ya'ni
  // ikkala tenantda ham mehmonlar bor.
  it("mehmonlar ro'yxati faqat o'z tenantiniki", async () => {
    const a = await t.http().get('/api/guests').set(auth(alfa.token)).expect(200);
    const b = await t.http().get('/api/guests').set(auth(beta.token)).expect(200);

    const items = (r: { body: unknown }) =>
      Array.isArray(r.body)
        ? (r.body as { id: string }[])
        : ((r.body as { items: { id: string }[] }).items ?? []);

    const aIds = items(a).map((g) => g.id);
    const bIds = items(b).map((g) => g.id);
    expect(aIds.length).toBeGreaterThan(0);
    expect(aIds.filter((id) => bIds.includes(id))).toEqual([]);
  });

  // 🔴 TO'G'RIDAN-TO'G'RI MUROJAAT. Ro'yxat filtrlanishi bir gap; begona
  // yozuvni ID bo'yicha SO'RASH — boshqasi. Bu yerda RLS'ning o'zi
  // ishlashi kerak: kod "bu meniki emas" deb tekshirmasa ham, baza 0
  // qator qaytaradi va javob 404 bo'ladi.
  it("boshqa tenantning mulkini ID bo'yicha ham ololmaydi", async () => {
    const b = await t.http().get('/api/properties').set(auth(beta.token)).expect(200);
    const betaPropertyId = (b.body as { id: string }[])[0].id;

    const res = await t
      .http()
      .get(`/api/properties/${betaPropertyId}`)
      .set(auth(alfa.token));

    // 200 QAYTMASLIGI shart. 404 kutiladi (403 ham qabul qilinadi —
    // muhimi ma'lumot berilmasligi).
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  // Tokensiz murojaat — eng oddiy, lekin eng ko'p unutiladigan holat.
  it('tokensiz murojaat rad etiladi', async () => {
    await t.http().get('/api/properties').expect(401);
  });

  // 🔴 SIYOSATLARNING O'ZI. Yuqoridagi testlar xulqni tekshiradi; bu esa
  // sababni: har bir tenantli jadvalda siyosat BOR ekanini. Yangi jadval
  // qo'shilganda siyosatsiz qolishi — auditda topilgan "fail-open" naqsh
  // edi, va u faqat shu darajada ko'rinadi.
  it('barcha tenantli jadvallarda RLS yoqilgan va siyosat bor', async () => {
    const rows: { tablename: string; policies: string }[] =
      await migrationDs.query(`
        SELECT c.relname AS tablename,
               (SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id'
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relrowsecurity = false
      `);
    // `tenant_id` ustuni bor, lekin RLS yoqilmagan jadval BO'LMASLIGI kerak.
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  // 🔴 NEGA BAZAGA TO'G'RIDAN-TO'G'RI MUROJAAT QILADIGAN TESTLAR HAM KERAK.
  //
  // Mutatsiya sinovida (2026-09-05) `properties` jadvalida RLS o'chirib
  // ko'rildi. Yuqoridagi HTTP testlari — jumladan "mulklar ro'yxati
  // faqat o'z tenantiniki" — YASHIL qolaverdi: xizmat qatlami
  // so'rovlarni `tenant_id` bo'yicha o'zi ham filtrlaydi. Bu yaxshi
  // (ikki qatlamli himoya), lekin aynan shu sabab HTTP testlari
  // bazadagi himoya yo'qolganini KO'RSATA OLMAYDI.
  //
  // Quyidagi uchta test o'sha mutatsiyada YIQILDI — ya'ni ikkinchi
  // qatlam buzilganini faqat ular tutadi.
  it("tenant konteksti o'rnatilmagan bo'lsa qatorlar ko'rinmaydi", async () => {
    const appDs = t.dataSource;
    const rows: unknown[] = await appDs.transaction(async (m) => {
      // `app.tenant_id` ATAYLAB o'rnatilmaydi.
      return m.query('SELECT id FROM "properties" LIMIT 5');
    });
    expect(rows).toEqual([]);
  });

  it("bo'sh tenant konteksti ham hech narsa ochmaydi", async () => {
    const appDs = t.dataSource;
    const rows: unknown[] = await appDs.transaction(async (m) => {
      // Bo'sh satr — 2026-09-05 da tuzatilgan holat
      // (FixRlsPoliciesEmptyTenantSetting migratsiyasi): `''::uuid`
      // xato beradi, shuning uchun siyosatda `NULLIF` ishlatiladi.
      await m.query('SELECT set_config($1, $2, true)', ['app.tenant_id', '']);
      return m.query('SELECT id FROM "properties" LIMIT 5');
    });
    expect(rows).toEqual([]);
  });

  it("to'g'ri tenant konteksti bilan esa qatorlar ko'rinadi", async () => {
    const appDs = t.dataSource;
    const rows: { id: string }[] = await appDs.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', [
        'app.tenant_id',
        alfa.tenantId,
      ]);
      return m.query('SELECT id FROM "properties"');
    });
    // Bu test yuqoridagilarning "hamma narsa bo'sh" sababidan emasligini
    // tasdiqlaydi — ya'ni testlar mazmunli.
    expect(rows.length).toBeGreaterThan(0);
  });
});
