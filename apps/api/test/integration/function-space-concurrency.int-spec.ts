import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 ZAL BANDLIGIDA POYGA HOLATI (2026-09-05).
//
// Xona bronida topilgan nuqson ("avval SELECT, keyin INSERT") xuddi shu
// ko'rinishda funksiya zallarida ham bor edi:
// `FunctionSpacesService.assertSpaceAvailable` — bir xil naqsh, faqat
// sana o'rniga timestamp ustunlar bilan.
//
// NIMA UCHUN BU HAM QIMMAT. To'y, konferensiya yoki banket zali —
// mehmonxona uchun bitta xonadan ko'ra ko'proq pul. Ikki tadbir bir
// vaqtga tushib qolsa, ulardan birini bekor qilish kerak bo'ladi va bu
// ko'pincha bir necha kun oldin ma'lum bo'ladi — ya'ni mijoz allaqachon
// taklifnoma tarqatgan.
//
// Nuqsonni izlashning sababi: bir joyda topilgan naqsh odatda yolg'iz
// bo'lmaydi. Nomzodlar ro'yxatidan tekshirildi — ombor
// (`stock.service.ts`) allaqachon `setLock('pessimistic_write')` bilan
// himoyalangan, `tenants.subdomain` da UNIQUE indeks bor. Zal bandligi
// esa ochiq qolgan edi.

jest.setTimeout(180_000);

describe('Zalni bir vaqtda bron qilish', () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let token: string;
  let propertyId: string;
  let spaceId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);
    t = await createTestApp();

    const reg = await registerTenant(t, {
      subdomain: 'zalpoyga',
      email: 'egasi@zalpoyga.uz',
      name: 'Zal Hotel',
    });
    token = reg.token;

    const props = await t.http().get('/api/properties').set(auth()).expect(200);
    propertyId = (props.body as { id: string }[])[0].id;

    const space = await t
      .http()
      .post(`/api/properties/${propertyId}/function-spaces`)
      .set(auth())
      .send({ name: 'Katta zal', capacity: 200 })
      .expect(201);
    spaceId = (space.body as { id: string }).id;
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  const bookOnce = (startTime: string, endTime: string, name = 'Tadbir') =>
    t
      .http()
      .post(`/api/properties/${propertyId}/function-space-bookings`)
      .set(auth())
      .send({
        functionSpaceId: spaceId,
        eventName: name,
        organizerName: 'Tashkilotchi',
        startTime,
        endTime,
      });

  it('ketma-ket yuborilganda ikkinchi tadbir rad etiladi', async () => {
    const start = '2026-11-10T10:00:00.000Z';
    const end = '2026-11-10T16:00:00.000Z';

    expect((await bookOnce(start, end, 'Birinchi')).status).toBe(201);
    expect((await bookOnce(start, end, 'Ikkinchi')).status).toBe(409);
  });

  // 🔴 ASOSIY TEST — xona bronidagi bilan bir xil.
  it("bir vaqtda yuborilganda ham faqat bitta tadbir o'tadi", async () => {
    const start = '2026-12-01T09:00:00.000Z';
    const end = '2026-12-01T18:00:00.000Z';

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => bookOnce(start, end, `Tadbir ${i}`)),
    );
    const created = results.filter((r) => r.status === 201);

    const rows: { count: string }[] = await migrationDs.query(
      `SELECT count(*) FROM "function_space_bookings"
        WHERE function_space_id = $1 AND status <> 'cancelled'
          AND start_time < $3 AND end_time > $2`,
      [spaceId, start, end],
    );

    expect({
      yaratildi: created.length,
      bazadagiQatorlar: Number(rows[0].count),
    }).toEqual({ yaratildi: 1, bazadagiQatorlar: 1 });
  });

  // Qisman ustma-ust vaqtlar: 10:00—14:00 va 13:00—17:00 bir zalda
  // bo'lishi mumkin emas.
  it("qisman ustma-ust vaqtlar ham bir vaqtda o'tmaydi", async () => {
    const results = await Promise.all([
      bookOnce('2026-12-15T10:00:00.000Z', '2026-12-15T14:00:00.000Z', 'A'),
      bookOnce('2026-12-15T13:00:00.000Z', '2026-12-15T17:00:00.000Z', 'B'),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  // Ketma-ket tadbirlar (biri tugagan payt ikkinchisi boshlanadi)
  // to'qnashuv EMAS — zalni kun davomida ikki marta ishlatish odatiy hol.
  it("ketma-ket (chegara tegib turgan) tadbirlar ikkalasi ham o'tadi", async () => {
    const first = await bookOnce(
      '2026-12-20T09:00:00.000Z',
      '2026-12-20T12:00:00.000Z',
      'Ertalabki',
    );
    const second = await bookOnce(
      '2026-12-20T12:00:00.000Z',
      '2026-12-20T15:00:00.000Z',
      'Tushdan keyingi',
    );
    expect([first.status, second.status]).toEqual([201, 201]);
  });
});
