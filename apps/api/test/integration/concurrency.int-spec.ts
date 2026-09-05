import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 BIR VAQTDA ISHLASH — IKKI KARRA BRON (2026-09-05).
//
// SAVOL. Ikki xodim (yoki sayt va Front Desk) bir vaqtning o'zida
// BITTA xonani BIR XIL sanaga bron qilsa nima bo'ladi?
//
// NIMA UCHUN BU JIDDIY. Ikki karra bron — mehmonxonadagi eng qimmat
// xatolardan biri: kelgan mehmonga xona yo'qligini aytish kerak
// bo'ladi, ko'pincha tunda va boshqa mehmonxona topib berish bilan.
// Bu pul va obro' masalasi.
//
// NIMA UCHUN BUNI FAQAT INTEGRATSION TEST TUTA OLADI. To'qnashuv
// tekshiruvi ikki bosqichdan iborat: avval SELECT (bo'sh xonami?),
// keyin INSERT. Ikki so'rov bir vaqtda kelsa, ikkalasi ham SELECT'da
// "bo'sh" deb ko'radi va ikkalasi ham yozadi. Mock bilan bu holatni
// yaratib bo'lmaydi — u haqiqiy tranzaksiya izolyatsiyasiga bog'liq.
//
// Bu test HAQIQIY parallel so'rovlar yuboradi.

jest.setTimeout(180_000);

interface Room {
  id: string;
  status: string;
  housekeepingStatus: string;
}

describe('Bir vaqtda bron qilish', () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let token: string;
  let propertyId: string;
  let businessDate: string;
  let roomId: string;
  let guestId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);
    t = await createTestApp();

    const reg = await registerTenant(t, {
      subdomain: 'poyga',
      email: 'egasi@poyga.uz',
      name: 'Poyga Hotel',
    });
    token = reg.token;

    const props = await t.http().get('/api/properties').set(auth()).expect(200);
    const p = (props.body as { id: string; businessDate: string }[])[0];
    propertyId = p.id;
    businessDate = p.businessDate;

    const rooms = await t
      .http()
      .get(`/api/properties/${propertyId}/rooms`)
      .set(auth())
      .expect(200);
    roomId = (rooms.body as Room[]).find((r) => r.status === 'available')!.id;

    const guests = await t.http().get('/api/guests').set(auth()).expect(200);
    const list = Array.isArray(guests.body)
      ? (guests.body as { id: string }[])
      : ((guests.body as { items: { id: string }[] }).items ?? []);
    guestId = list[0].id;
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  const bookOnce = (checkIn: string, checkOut: string) =>
    t
      .http()
      .post(`/api/properties/${propertyId}/bookings`)
      .set(auth())
      .send({ roomId, guestId, checkIn, checkOut });

  it('ketma-ket yuborilganda ikkinchi bron rad etiladi', async () => {
    const checkIn = addDays(businessDate, 10);
    const checkOut = addDays(businessDate, 12);

    const first = await bookOnce(checkIn, checkOut);
    expect(first.status).toBe(201);

    const second = await bookOnce(checkIn, checkOut);
    expect(second.status).toBe(409);
  });

  // 🔴 ASOSIY TEST. Bir vaqtda yuborilgan 5 ta so'rovdan ATIGI BITTASI
  // muvaffaqiyatli bo'lishi kerak.
  it("bir vaqtda yuborilganda ham faqat bitta bron o'tadi", async () => {
    const checkIn = addDays(businessDate, 20);
    const checkOut = addDays(businessDate, 22);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => bookOnce(checkIn, checkOut)),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    // Bazadagi haqiqiy holatni ham tekshiramiz — javob kodi bir gap,
    // yozilgan qator boshqa gap.
    const rows: { count: string }[] = await migrationDs.query(
      `SELECT count(*) FROM "bookings"
        WHERE room_id = $1 AND check_in = $2 AND check_out = $3
          AND status <> 'cancelled'`,
      [roomId, checkIn, checkOut],
    );

    expect({
      yaratildi: created.length,
      radEtildi: rejected.length,
      bazadagiQatorlar: Number(rows[0].count),
    }).toEqual({ yaratildi: 1, radEtildi: 4, bazadagiQatorlar: 1 });
  });

  // Qisman ustma-ust tushadigan sanalar ham to'qnashuv hisoblanadi:
  // 1-3 va 2-4 bir xil xonada bo'lishi mumkin emas.
  it("qisman ustma-ust sanalar ham bir vaqtda o'tmaydi", async () => {
    const a = { in: addDays(businessDate, 30), out: addDays(businessDate, 33) };
    const b = { in: addDays(businessDate, 31), out: addDays(businessDate, 34) };

    const results = await Promise.all([
      bookOnce(a.in, a.out),
      bookOnce(b.in, b.out),
    ]);
    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
  });
});

/** `YYYY-MM-DD` ga kun qo'shadi (UTC — vaqt zonasi siljishisiz). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
