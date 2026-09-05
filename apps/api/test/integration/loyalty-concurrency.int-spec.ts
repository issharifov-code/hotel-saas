import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 SODIQLIK BALLARIDA "YO'QOLGAN YANGILANISH" (2026-09-05).
//
// Bron poygalaridan keyin qidiruv davom ettirildi va boshqa turdagi
// naqsh topildi: o'qi–hisobla–yoz (read-modify-write).
//
//     const guest = await this.guestRepo.findOneBy({ id });   // o'qish
//     const newBalance = guest.loyaltyPoints + delta;         // hisoblash
//     guest.loyaltyPoints = newBalance;
//     await this.guestRepo.save(guest);                       // MUTLAQ qiymat yozish
//
// Ikki so'rov bir vaqtda kelsa, ikkalasi ham BIR XIL boshlang'ich
// qiymatni o'qiydi va ikkalasi ham o'zining natijasini yozadi —
// ikkinchisi birinchisini bosib ketadi. Bu "lost update".
//
// NIMA UCHUN BU BRON POYGASIDAN BOSHQACHA. U yerda muammo "ikkita
// qator paydo bo'ldi" edi va baza cheklovi bilan hal bo'ldi. Bu
// yerda esa qator bitta, lekin QIYMAT noto'g'ri — cheklov buni
// ushlay olmaydi.
//
// PULDAGI OQIBATI. Ikki marta ball yechish (masalan ikki kassada bir
// vaqtda) mehmonga IKKI BAROBAR qiymat beradi, mehmonxonadan esa
// faqat bir marta ayiriladi. Teskari yo'nalishda ham xato: bir vaqtda
// ikki to'lovdan ball hisoblansa, mehmon ballning yarmini yo'qotadi.

jest.setTimeout(180_000);

interface Guest {
  id: string;
  loyaltyPoints: number;
}

describe("Sodiqlik ballari — bir vaqtda o'zgartirish", () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let token: string;
  let guestId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);
    t = await createTestApp();

    const reg = await registerTenant(t, {
      subdomain: 'ballpoyga',
      email: 'egasi@ballpoyga.uz',
      name: 'Ball Hotel',
    });
    token = reg.token;

    const guests = await t.http().get('/api/guests').set(auth()).expect(200);
    const list = Array.isArray(guests.body)
      ? (guests.body as Guest[])
      : ((guests.body as { items: Guest[] }).items ?? []);
    guestId = list[0].id;
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  const adjust = (points: number, reason = 'sinov') =>
    t
      .http()
      .post(`/api/guests/${guestId}/loyalty/adjust`)
      .set(auth())
      .send({ points, reason });

  const balance = async (): Promise<number> => {
    const rows: { loyalty_points: number }[] = await migrationDs.query(
      'SELECT loyalty_points FROM "guests" WHERE id = $1',
      [guestId],
    );
    return Number(rows[0].loyalty_points);
  };

  const setBalance = async (value: number) => {
    await migrationDs.query(
      'UPDATE "guests" SET loyalty_points = $2 WHERE id = $1',
      [guestId, value],
    );
  };

  it('ketma-ket qo\'shish to\'g\'ri jamlanadi', async () => {
    await setBalance(0);
    await adjust(10).expect(201);
    await adjust(10).expect(201);
    await adjust(10).expect(201);
    expect(await balance()).toBe(30);
  });

  // 🔴 ASOSIY TEST — QO'SHISH. Bir vaqtda 5 ta "+10" yuboriladi.
  // To'g'ri natija: 50. "Lost update" bo'lsa — undan kam.
  it("bir vaqtda qo'shilgan ballar yo'qolmaydi", async () => {
    await setBalance(0);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => adjust(10, 'parallel qo\'shish')),
    );
    // Hammasi qabul qilinishi kerak — bu yerda hech qanday to'qnashuv
    // qoidasi yo'q, faqat jamlash.
    expect(results.every((r) => r.status === 201)).toBe(true);

    expect(await balance()).toBe(50);
  });

  // 🔴 ASOSIY TEST — YECHISH. Eng qimmat holat.
  // Qoldiq 100. Bir vaqtda 5 ta "−80" yuboriladi.
  // To'g'ri natija: FAQAT BITTASI o'tadi (qolganlari manfiy qoldiq
  // sababli rad etiladi), qoldiq 20 bo'ladi.
  it("qoldiqdan ortiq yechishga bir vaqtda urinish rad etiladi", async () => {
    await setBalance(100);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => adjust(-80, 'parallel yechish')),
    );
    const ok = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status >= 400);

    expect({
      otdi: ok.length,
      radEtildi: rejected.length,
      qoldiq: await balance(),
    }).toEqual({ otdi: 1, radEtildi: 4, qoldiq: 20 });
  });

  // Qoldiq HECH QACHON manfiy bo'lmasligi kerak — bu eng oxirgi
  // himoya chizig'i.
  it("qoldiq hech qachon manfiy bo'lmaydi", async () => {
    await setBalance(50);
    await Promise.all([adjust(-30), adjust(-30), adjust(-30)]);
    expect(await balance()).toBeGreaterThanOrEqual(0);
  });
});
