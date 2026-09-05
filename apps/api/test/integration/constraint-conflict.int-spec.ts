import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 BAZA CHEKLOVI POYGADA — JAVOB QANDAY KO'RINADI (2026-09-05).
//
// Bu to'plam ikkita alohida narsani bir vaqtda tekshiradi:
//
//   1. CHEKLOVNING O'ZI. `attendance_records` va `payroll_runs` da
//      unikal indekslar bor (`property+xodim+sana`, `property+yil+oy`).
//      Ilova kodi "avval qidiramiz, topilmasa yozamiz" naqshi bilan
//      ishlaydi — bu naqsh POYGADA yolg'on: ikkala so'rov ham "topilmadi"
//      deb qaror qiladi. Yagona haqiqiy to'siq — baza indeksi.
//
//   2. JAVOB SHAKLI. Cheklov ushlaganda ilgari 500 qaytardi
//      ("Serverda kutilmagan xatolik") va yozuv `error_events` ga tushib
//      Telegram ogohlantirishini qo'zg'atardi. Ya'ni MUTLAQO NORMAL
//      raqobat holati avariya sifatida ko'rinardi. Endi 409 qaytadi.
//
// Nima uchun bu integratsion testda, unit testda emas: unit test
// PostgreSQL indeksini ham, bir vaqtda kelgan ikki tranzaksiyani ham
// taqlid qila olmaydi. Bu yerdagi butun mavzu — aynan o'sha ikkisi.

jest.setTimeout(180_000);

describe('Baza cheklovi poygada — 409, 500 emas', () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let token: string;
  let propertyId: string;
  let userId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);
    t = await createTestApp();

    const reg = await registerTenant(t, {
      subdomain: 'cheklov',
      email: 'egasi@cheklov.uz',
      name: 'Cheklov Hotel',
    });
    token = reg.token;
    userId = reg.userId;

    const props = await t.http().get('/api/properties').set(auth()).expect(200);
    propertyId = (props.body as { id: string }[])[0].id;
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  describe('davomat yozuvi (property + xodim + sana)', () => {
    const DATE = '2026-03-15';

    const upsert = (status: string) =>
      t
        .http()
        .put(`/api/properties/${propertyId}/attendance/${userId}/${DATE}`)
        .set(auth())
        .send({ status, hoursWorked: 8 });

    const rowCount = async (): Promise<number> => {
      const rows: { count: string }[] = await migrationDs.query(
        'SELECT count(*) FROM "attendance_records" WHERE user_id = $1 AND date = $2',
        [userId, DATE],
      );
      return Number(rows[0].count);
    };

    it('ketma-ket yuborilgan yangilanish bitta qator qoldiradi', async () => {
      await upsert('present').expect(200);
      await upsert('absent').expect(200);
      expect(await rowCount()).toBe(1);
    });

    // 🔴 ASOSIY TEST. Bir vaqtda 5 ta yozuv yuboriladi.
    //
    // KUTILGAN NATIJA: bitta qator, va HECH BIR so'rov 5xx olmaydi.
    //
    // 📌 NIMA UCHUN HAMMASI 200 QAYTADI (o'lchangan, taxmin emas).
    // Har bir so'rov o'z tranzaksiyasida ishlaydi (RlsContextService) va
    // unikal indeks ikkinchi INSERT ni birinchisi COMMIT bo'lgunicha
    // KUTTIRADI. Kutish tugagach ikkinchi so'rov endi mavjud qatorni
    // ko'radi va uni YANGILAYDI. Ya'ni indeks bu yerda xato bermaydi —
    // u so'rovlarni navbatga soladi. Aynan shuning uchun natija to'g'ri.
    it("bir vaqtda yuborilgan yozuvlar bitta qator hosil qiladi", async () => {
      await migrationDs.query('DELETE FROM "attendance_records" WHERE user_id = $1', [userId]);

      const results = await Promise.all([
        upsert('present'),
        upsert('absent'),
        upsert('leave'),
        upsert('holiday'),
        upsert('present'),
      ]);

      expect(await rowCount()).toBe(1);
      expect(results.every((r) => r.status < 500)).toBe(true);
    });

    // 🔴 INDEKSNING O'ZI. Yuqoridagi test ilova xatti-harakatini
    // tekshiradi, bu esa POSTGRESQL CHEKLOVINI: ikkita xom INSERT
    // ikkita ALOHIDA ulanishdan bir vaqtda yuboriladi.
    //
    // Nima uchun kerak: ilova yo'lida cheklov hech qachon "otilmaydi"
    // (yuqoriga qarang — u faqat navbat hosil qiladi), ya'ni oddiy
    // testlar indeks BOR-YO'QLIGINI umuman sezmaydi. Kimdir uni
    // migratsiyadan olib tashlasa, faqat shu test yiqiladi.
    it('unikal indeks ikkinchi qatorni haqiqatan rad etadi', async () => {
      await migrationDs.query('DELETE FROM "attendance_records" WHERE user_id = $1', [userId]);

      const insert = () =>
        migrationDs.query(
          `INSERT INTO "attendance_records"
             (tenant_id, property_id, user_id, date, status, recorded_by_user_id)
           SELECT tenant_id, $1, $2, $3, 'present', $2 FROM "properties" WHERE id = $1`,
          [propertyId, userId, DATE],
        );

      const outcomes = await Promise.allSettled([insert(), insert()]);
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      expect(rejected).toHaveLength(1);
      expect(String((rejected[0] as PromiseRejectedResult).reason)).toContain('duplicate key');
      expect(await rowCount()).toBe(1);
    });

    // Agar takrorlanish 500 bo'lib qolsa, u `error_events` ga yozilar
    // va Telegram ogohlantirishini qo'zg'atardi. Bu test aynan shuni
    // qo'riqlaydi: normal raqobat holati xato jurnaliga TUSHMAYDI.
    it("takrorlanish xato jurnaliga yozilmaydi", async () => {
      await migrationDs.query('DELETE FROM "attendance_records" WHERE user_id = $1', [userId]);
      await migrationDs.query('DELETE FROM "error_events"');

      await Promise.all([upsert('present'), upsert('absent'), upsert('leave')]);

      const rows: { count: string }[] = await migrationDs.query(
        'SELECT count(*) FROM "error_events"',
      );
      expect(Number(rows[0].count)).toBe(0);
    });
  });

  describe('payroll davri (property + yil + oy)', () => {
    const createRun = () =>
      t
        .http()
        .post(`/api/properties/${propertyId}/payroll-runs`)
        .set(auth())
        .send({ periodYear: 2026, periodMonth: 3 });

    const runCount = async (): Promise<number> => {
      const rows: { count: string }[] = await migrationDs.query(
        'SELECT count(*) FROM "payroll_runs" WHERE property_id = $1 AND period_year = 2026 AND period_month = 3',
        [propertyId],
      );
      return Number(rows[0].count);
    };

    // Payroll faqat maoshi belgilangan xodim bo'lganda yaratiladi —
    // aks holda 400 qaytadi va test hech narsani tekshirmagan bo'lardi
    // (aynan shu tuzoqqa birinchi urinishda tushildi: uchala so'rov ham
    // 400 olgan, ya'ni "payroll ikki marta yaratilmadi" degan xulosa
    // yolg'on edi — u umuman yaratilmagan edi).
    beforeAll(async () => {
      // Maosh EGANING O'ZIGA qo'yilmaydi: `PATCH /users/:id/salary`
      // o'z-o'ziga o'zgartirishni ataylab rad etadi (2026-09-05
      // xavfsizlik auditi — buxgalter o'z maoshini oshirib, keyin
      // payroll qilib to'lay olardi). Shuning uchun alohida xodim
      // yaratiladi.
      const created = await t
        .http()
        .post('/api/users')
        .set(auth())
        .send({
          email: 'xodim@cheklov.uz',
          password: 'Integratsiya!2026',
          fullName: 'Maoshli Xodim',
        })
        .expect(201);

      const staffId = (created.body as { id: string }).id;

      await t
        .http()
        .patch(`/api/users/${staffId}/salary`)
        .set(auth())
        .send({ salaryType: 'monthly', salaryAmount: '5000000.00' })
        .expect(200);
    });

    // 🔴 PULDAGI OQIBATI. Bir oy uchun ikkita payroll — bu har bir
    // xodim uchun ikkita payslip, ya'ni ikki barobar maosh majburiyati.
    it('bir oy uchun ikkinchi payroll yaratilmaydi', async () => {
      await migrationDs.query('DELETE FROM "payroll_runs" WHERE property_id = $1', [propertyId]);

      const results = await Promise.all([createRun(), createRun(), createRun()]);

      // ANIQ BITTA yaratilgan bo'lishi kerak — "1 tadan ko'p emas" emas.
      expect(await runCount()).toBe(1);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);

      // Qolgan ikkitasi 409 — va hech biri 5xx emas.
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(409);
      }
    });
  });
});
