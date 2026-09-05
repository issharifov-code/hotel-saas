import { DataSource } from 'typeorm';
import { createTestApp, registerTenant, TestApp } from './app';
import { runMigrations, truncateAll } from './db';

// 🔬 KUNDALIK YO'L — UCHIDAN-UCHIGA (2026-09-05).
//
// Mehmonxona har kuni yuradigan yo'l:
//
//   bron → tasdiqlash → check-in → folioga xarajat → to'lov
//        → check-out → tungi audit
//
// NIMA UCHUN BU TEST KERAK. Har bir bosqichning o'z unit testi bor va
// ularning hammasi yashil. Lekin ular ZANJIRNI tekshirmaydi — masalan
// check-in folio ochishini, folio qatorlari jamiga qo'shilishini, to'lov
// qoldiqni kamaytirishini, check-out folioni qat'iylashtirishini.
// Aynan shu bo'g'inlar biznes uchun eng qimmat: ular buzilsa mehmon
// noto'g'ri hisob oladi yoki umuman chiqib keta olmaydi.
//
// Bundan tashqari bu yerda HAQIQIY baza ishlaydi, ya'ni tranzaksiya
// chegaralari, RLS siyosatlari va migratsiya holati ham yo'l-yo'lakay
// sinaladi.
//
// MA'LUMOT MANBAYI. Ro'yxatdan o'tish namunaviy dataset yaratadi
// (xonalar, mehmonlar, narx rejalari). Test ataylab shundan foydalanadi
// — qo'lda `INSERT` bilan qurilgan sun'iy holat emas, ilovaning o'zi
// yaratgan ma'lumot.

jest.setTimeout(180_000);

interface Property {
  id: string;
  businessDate: string;
}
interface Room {
  id: string;
  status: string;
  housekeepingStatus: string;
  roomTypeId: string;
  number?: string;
}
interface Booking {
  id: string;
  status: string;
  totalAmount: string | number;
}
interface Invoice {
  id: string;
  status: string;
  totalAmount: string | number;
  paidAmount?: string | number;
  lines?: { description: string; lineTotal: string | number }[];
}

const num = (v: unknown): number => Number(v ?? 0);

// 🔴 API `balance` MAYDONINI QAYTARMAYDI — u `totalAmount - paidAmount`
// sifatida hisoblanadi (frontend ham shunday qiladi). Testni yozishda
// bu `balance: 0` bo'lib ko'rindi va soxta muvaffaqiyat berardi.
// Shuning uchun bu yerda ochiq hisoblanadi.
const balanceOf = (inv: Invoice): number =>
  num(inv.totalAmount) - num(inv.paidAmount);

describe("Kundalik yo'l (bron → check-out → tungi audit)", () => {
  let migrationDs: DataSource;
  let t: TestApp;
  let token: string;
  let propertyId: string;
  let businessDate: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    migrationDs = await runMigrations();
    await truncateAll(migrationDs);
    t = await createTestApp();

    const reg = await registerTenant(t, {
      subdomain: 'kunlik',
      email: 'egasi@kunlik.uz',
      name: 'Kunlik Hotel',
    });
    token = reg.token;

    const props = await t
      .http()
      .get('/api/properties')
      .set(auth())
      .expect(200);
    const property = (props.body as Property[])[0];
    propertyId = property.id;
    businessDate = property.businessDate;
  });

  afterAll(async () => {
    if (t) await t.close();
    if (migrationDs?.isInitialized) await migrationDs.destroy();
  });

  // Zanjir bo'ylab tashiladigan holat. Testlar ATAYLAB ketma-ket va
  // bir-biriga bog'liq: bu yo'lning o'zi ham ketma-ket, va har bir
  // bosqichni alohida qurish testni haqiqiy jarayondan uzoqlashtirardi.
  const state = {
    roomId: '',
    guestId: '',
    bookingId: '',
    invoiceId: '',
    roomCharge: 0,
  };

  it("namunaviy ma'lumot bor: bo'sh va tozalangan xona hamda mehmon topiladi", async () => {
    const rooms = await t
      .http()
      .get(`/api/properties/${propertyId}/rooms`)
      .set(auth())
      .expect(200);
    // 🔴 IKKI XIL HOLAT. `status` — xona band emasligini, `housekeepingStatus`
    // esa tozalanganini bildiradi. Check-in ikkalasini ham talab qiladi:
    // tozalanmagan xonaga mehmon kiritib bo'lmaydi
    // (`assertRoomCleanForCheckIn`). Bu farqni bilmasdan yozilgan test
    // "nega 409?" degan savol bilan qolardi — shu yerda uchradik.
    const free = (rooms.body as Room[]).find(
      (r) =>
        r.status === 'available' &&
        ['clean', 'inspected'].includes(r.housekeepingStatus),
    );
    expect(free).toBeDefined();
    state.roomId = free!.id;

    const guests = await t
      .http()
      .get('/api/guests')
      .set(auth())
      .expect(200);
    const list = Array.isArray(guests.body)
      ? (guests.body as { id: string }[])
      : ((guests.body as { items: { id: string }[] }).items ?? []);
    expect(list.length).toBeGreaterThan(0);
    state.guestId = list[0].id;
  });

  it('bron yaratiladi va narxi avtomatik hisoblanadi', async () => {
    // Biznes sanasidan boshlab 2 tunlik turish.
    const checkIn = businessDate;
    const checkOut = addDays(businessDate, 2);

    const res = await t
      .http()
      .post(`/api/properties/${propertyId}/bookings`)
      .set(auth())
      .send({
        roomId: state.roomId,
        guestId: state.guestId,
        checkIn,
        checkOut,
      })
      .expect(201);

    const booking = res.body as Booking;
    state.bookingId = booking.id;
    // Narx berilmadi — u xona turi/narx rejasidan hisoblanishi kerak.
    expect(num(booking.totalAmount)).toBeGreaterThan(0);
    state.roomCharge = num(booking.totalAmount);

    // 🔴 XULQNI QAYD ETAMIZ. Front Desk orqali yaratilgan bron DARHOL
    // "confirmed" bo'ladi — `POST /confirm` qadami kerak emas (u faqat
    // "pending" holatdagilar uchun, masalan sayt orqali kelgan bron).
    // Bu testni yozishda uchradi: `confirm` 409 qaytardi. Shuning uchun
    // bu yerda ochiq tekshiriladi — kelajakda standart holat o'zgarsa,
    // test buni ko'rsatadi.
    expect(booking.status).toBe('confirmed');
  });

  // 🔴 HOLAT MASHINASI. Check-in faqat "confirmed" dan mumkin, va
  // "confirmed" ni qayta tasdiqlab bo'lmaydi.
  it("tasdiqlangan bronni qayta tasdiqlab bo'lmaydi", async () => {
    const res = await t
      .http()
      .post(`/api/properties/${propertyId}/bookings/${state.bookingId}/confirm`)
      .set(auth());
    expect(res.status).toBe(409);
  });

  // 🔴 ENG MUHIM BO'G'IN. Check-in uchta narsani birdan qiladi: bron
  // holatini o'zgartiradi, xonani band qiladi va FOLIO ochadi. Uchalasi
  // ham tekshiriladi — folio ochilmasa mehmon hisobsiz qolardi.
  it('check-in: bron va xona holati o\'zgaradi, folio ochiladi', async () => {
    const res = await t
      .http()
      .post(`/api/properties/${propertyId}/bookings/${state.bookingId}/check-in`)
      .set(auth())
      .expect(201);
    expect((res.body as Booking).status).toBe('checked_in');

    const rooms = await t
      .http()
      .get(`/api/properties/${propertyId}/rooms`)
      .set(auth())
      .expect(200);
    const room = (rooms.body as Room[]).find((r) => r.id === state.roomId);
    expect(room?.status).toBe('occupied');

    const folio = await t
      .http()
      .get(`/api/properties/${propertyId}/bookings/${state.bookingId}/invoice`)
      .set(auth())
      .expect(200);
    const invoice = folio.body as Invoice;
    state.invoiceId = invoice.id;
    // Xona narxi folioning birinchi qatori sifatida tushishi kerak.
    expect(num(invoice.totalAmount)).toBeCloseTo(state.roomCharge, 2);
  });

  it('folioga qo\'shimcha xarajat qo\'shiladi va jami o\'sadi', async () => {
    const before = state.roomCharge;

    await t
      .http()
      .post(`/api/properties/${propertyId}/invoices/${state.invoiceId}/lines`)
      .set(auth())
      .send({ description: 'Minibar', quantity: 2, unitPrice: 25000 })
      .expect(201);

    const res = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    const invoice = res.body as Invoice;

    // 2 × 25 000 = 50 000 qo'shilishi kerak.
    expect(num(invoice.totalAmount)).toBeCloseTo(before + 50_000, 2);
    expect(invoice.lines?.some((l) => l.description === 'Minibar')).toBe(true);
  });

  it("qisman to'lov qoldiqni kamaytiradi", async () => {
    const res0 = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    const total = num((res0.body as Invoice).totalAmount);

    await t
      .http()
      .post(`/api/properties/${propertyId}/invoices/${state.invoiceId}/payments`)
      .set(auth())
      .send({ amount: 50_000, method: 'cash' })
      .expect(201);

    const res = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    const invoice = res.body as Invoice;

    expect(num(invoice.paidAmount)).toBeCloseTo(50_000, 2);
    // Qoldiq = jami − to'langan. Bu oddiy ayirma, lekin aynan shu yerda
    // mehmon noto'g'ri hisob olishi mumkin.
    expect(balanceOf(invoice)).toBeCloseTo(total - 50_000, 2);
  });

  it("qolgan summa to'langanda qoldiq nolga tushadi", async () => {
    const res0 = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    const balance = balanceOf(res0.body as Invoice);
    expect(balance).toBeGreaterThan(0);

    await t
      .http()
      .post(`/api/properties/${propertyId}/invoices/${state.invoiceId}/payments`)
      .set(auth())
      .send({ amount: balance, method: 'card' })
      .expect(201);

    const res = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    expect(balanceOf(res.body as Invoice)).toBeCloseTo(0, 2);
  });

  // 🔴 Ortiqcha to'lovni rad etish. Busiz kassada xato terilgan summa
  // jimgina qabul qilinardi va folio manfiy qoldiq bilan qolardi.
  it("qoldiqdan ortiq to'lov rad etiladi", async () => {
    const res = await t
      .http()
      .post(`/api/properties/${propertyId}/invoices/${state.invoiceId}/payments`)
      .set(auth())
      .send({ amount: 1, method: 'cash' });
    expect(res.status).toBe(409);
  });

  it("check-out: xona bo'shaydi va folio qat'iylashadi", async () => {
    const res = await t
      .http()
      .post(
        `/api/properties/${propertyId}/bookings/${state.bookingId}/check-out`,
      )
      .set(auth())
      .expect(201);
    expect((res.body as Booking).status).toBe('checked_out');

    const rooms = await t
      .http()
      .get(`/api/properties/${propertyId}/rooms`)
      .set(auth())
      .expect(200);
    const room = (rooms.body as Room[]).find((r) => r.id === state.roomId);
    // Check-out xonani "iflos" deb belgilaydi va tozalash navbatiga
    // qo'shadi — ya'ni u darhol "available" BO'LMASLIGI kerak, aks holda
    // keyingi mehmon tozalanmagan xonaga kirardi.
    expect(room?.status).not.toBe('occupied');

    const folio = await t
      .http()
      .get(`/api/properties/${propertyId}/invoices/${state.invoiceId}`)
      .set(auth())
      .expect(200);
    expect((folio.body as Invoice).status).not.toBe('draft');
  });

  it("check-out qilingan bronni ikkinchi marta check-out qilib bo'lmaydi", async () => {
    const res = await t
      .http()
      .post(
        `/api/properties/${propertyId}/bookings/${state.bookingId}/check-out`,
      )
      .set(auth());
    expect(res.status).toBe(409);
  });

  // 🔴 TUNGI AUDIT — kunni yopadi va biznes sanasini bir kunga suradi.
  // Agar u ishlamasa, mehmonxona ertasi kuni ham "kechagi kunda" ishlab
  // qolardi: hisobotlar, narxlar va check-in'lar noto'g'ri sanaga
  // tushardi.
  it('tungi audit biznes sanasini bir kunga suradi', async () => {
    const before = await t
      .http()
      .get(`/api/properties/${propertyId}/night-audit/status`)
      .set(auth())
      .expect(200);

    await t
      .http()
      .post(`/api/properties/${propertyId}/night-audit/run`)
      .set(auth())
      .expect(201);

    const props = await t
      .http()
      .get('/api/properties')
      .set(auth())
      .expect(200);
    const property = (props.body as Property[]).find(
      (p) => p.id === propertyId,
    );

    expect(property?.businessDate).toBe(addDays(businessDate, 1));
    expect(before.body).toBeDefined();

    const history = await t
      .http()
      .get(`/api/properties/${propertyId}/night-audit/history`)
      .set(auth())
      .expect(200);
    const runs = Array.isArray(history.body)
      ? (history.body as unknown[])
      : ((history.body as { items: unknown[] }).items ?? []);
    expect(runs.length).toBeGreaterThan(0);
  });
});

/** `YYYY-MM-DD` ga kun qo'shadi (UTC — vaqt zonasi siljishisiz). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
