import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GuestsService } from './guests.service';
import {
  CommunicationPreference,
  LoyaltyTier,
  ProfileType,
} from './entities/guest.entity';
import { LoyaltyService } from './loyalty.service';

// Bu testlar GuestsService'ning ikkita yangi qobiliyatini tekshiradi:
// (1) findDuplicateGroups — telefon/email/hujjat raqami bo'yicha, shu jumladan
// tranzitiv (A-B, B-C -> {A,B,C}) bog'lanishlarni to'g'ri guruhlashi;
// (2) mergeGuests — bo'sh maydonlarni to'ldirishi, loyalty ballarini qo'shishi,
// bog'liq yozuvlarni (booking/invoice/pos/loyalty tx) ko'chirishi va duplikatni
// o'chirishi. Haqiqiy DB o'rniga xotirada ishlaydigan minimal mocklar kifoya.
describe('GuestsService', () => {
  function createService(initialGuests: Array<Record<string, unknown>>) {
    const guests = initialGuests.map((g) => ({
      phone: null,
      email: null,
      nationality: null,
      documentType: null,
      documentNumber: null,
      dateOfBirth: null,
      notes: null,
      roomPreference: null,
      dietaryPreference: null,
      communicationPreference: CommunicationPreference.EMAIL,
      loyaltyPoints: 0,
      lifetimePoints: 0,
      loyaltyTier: LoyaltyTier.BRONZE,
      createdAt: new Date(),
      ...g,
    }));

    let nextNewId = 0;
    const guestRepo = {
      // 2026-09-04: merge agentlik/korporativ hisob havolalarini xom SQL
      // bilan ko'chiradi (ular profilga RESTRICT FK bilan bog'langan).
      manager: { query: jest.fn().mockResolvedValue([]) },
      find: jest
        .fn()
        .mockImplementation(({ where: { tenantId } }) =>
          Promise.resolve(guests.filter((g) => g.tenantId === tenantId)),
        ),
      findOneBy: jest
        .fn()
        .mockImplementation(
          ({ id, tenantId }: { id: string; tenantId: string }) =>
            Promise.resolve(
              guests.find((g) => g.id === id && g.tenantId === tenantId) ??
                null,
            ),
        ),
      // `GuestsService.create` (va shu orqali `findOrCreateForBooking`) uchun —
      // haqiqiy TypeORM `.create()` kabi, hali saqlanmagan yangi entity obyektini
      // qaytaradi (`id` faqat `.save()` chaqirilganda "beriladi").
      create: jest.fn((data: Record<string, unknown>) => ({
        phone: null,
        email: null,
        nationality: null,
        documentType: null,
        documentNumber: null,
        roomPreference: null,
        dietaryPreference: null,
        communicationPreference: CommunicationPreference.EMAIL,
        loyaltyPoints: 0,
        lifetimePoints: 0,
        loyaltyTier: LoyaltyTier.BRONZE,
        createdAt: new Date(),
        ...data,
      })),
      save: jest.fn().mockImplementation((g: Record<string, unknown>) => {
        const idx = guests.findIndex((x) => x.id === g.id);
        if (idx >= 0) {
          guests[idx] = { ...guests[idx], ...g };
          return Promise.resolve(guests[idx]);
        }
        // Yangi (hali `id`siz) mehmon — `save()` yangi id "beradi", xotiradagi
        // ro'yxatga qo'shiladi (haqiqiy DB'ning auto-generate xulq-atvorini taqlid qiladi).
        const created = { ...g, id: g.id ?? `new-guest-${nextNewId++}` };
        guests.push(created as never);
        return Promise.resolve(created);
      }),
      remove: jest.fn().mockImplementation((g: Record<string, unknown>) => {
        const idx = guests.findIndex((x) => x.id === g.id);
        if (idx >= 0) guests.splice(idx, 1);
        return Promise.resolve(g);
      }),
    };

    const updateCalls: Array<{
      repo: string;
      criteria: unknown;
      partial: unknown;
    }> = [];
    const makeUpdateRepo = (name: string) => ({
      update: jest
        .fn()
        .mockImplementation((criteria: unknown, partial: unknown) => {
          updateCalls.push({ repo: name, criteria, partial });
          return Promise.resolve({ affected: 1 });
        }),
    });

    const bookingRepo = makeUpdateRepo('booking');
    const invoiceRepo = makeUpdateRepo('invoice');
    const posOrderRepo = makeUpdateRepo('posOrder');
    const loyaltyTxRepo = makeUpdateRepo('loyaltyTx');

    // calculateTier — sof funksiya, haqiqiy repo'larga hech qachon murojaat
    // qilmaydi, shuning uchun mock o'rniga haqiqiy LoyaltyService ishlatish xavfsiz.
    const loyaltyService = new LoyaltyService(
      undefined as never,
      undefined as never,
    );

    const service = new GuestsService(
      guestRepo as never,
      bookingRepo as never,
      invoiceRepo as never,
      posOrderRepo as never,
      loyaltyTxRepo as never,
      loyaltyService,
    );

    return {
      service,
      guests,
      guestRepo,
      bookingRepo,
      invoiceRepo,
      posOrderRepo,
      loyaltyTxRepo,
      updateCalls,
    };
  }

  describe('findDuplicateGroups', () => {
    it("telefon bo'yicha mos keluvchi mehmonlarni bitta guruhga birlashtiradi (bo'shliq/format farqidan qat'iy nazar)", async () => {
      const { service } = createService([
        { id: 'g1', tenantId: 't1', phone: '+998 90 123-45-67' },
        { id: 'g2', tenantId: 't1', phone: '998901234567' },
        { id: 'g3', tenantId: 't1', phone: '+998901112233' },
      ]);
      const groups = await service.findDuplicateGroups('t1');
      expect(groups).toHaveLength(1);
      expect(groups[0].map((g) => g.id).sort()).toEqual(['g1', 'g2']);
    });

    it("tranzitiv bog'lanishlarni (A-B telefon, B-C email) bitta guruhga qo'shadi", async () => {
      const { service } = createService([
        { id: 'g1', tenantId: 't1', phone: '900000000' },
        { id: 'g2', tenantId: 't1', phone: '900000000', email: 'a@x.uz' },
        { id: 'g3', tenantId: 't1', email: 'A@X.UZ' },
      ]);
      const groups = await service.findDuplicateGroups('t1');
      expect(groups).toHaveLength(1);
      expect(groups[0].map((g) => g.id).sort()).toEqual(['g1', 'g2', 'g3']);
    });

    it("hech qanday maydon mos kelmasa bo'sh natija qaytaradi", async () => {
      const { service } = createService([
        { id: 'g1', tenantId: 't1', phone: '111' },
        { id: 'g2', tenantId: 't1', phone: '222' },
      ]);
      const groups = await service.findDuplicateGroups('t1');
      expect(groups).toHaveLength(0);
    });

    it("boshqa tenant'ning mehmonlarini hisobga olmaydi", async () => {
      const { service } = createService([
        { id: 'g1', tenantId: 't1', phone: '111' },
        { id: 'g2', tenantId: 't2', phone: '111' },
      ]);
      const groups = await service.findDuplicateGroups('t1');
      expect(groups).toHaveLength(0);
    });
  });

  describe('mergeGuests', () => {
    it("o'zini o'ziga birlashtirishga urinilsa xato tashlaydi", async () => {
      const { service } = createService([{ id: 'g1', tenantId: 't1' }]);
      await expect(service.mergeGuests('t1', 'g1', 'g1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it("mavjud bo'lmagan mehmon uchun NotFoundException tashlaydi", async () => {
      const { service } = createService([{ id: 'g1', tenantId: 't1' }]);
      await expect(service.mergeGuests('t1', 'g1', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("bo'sh maydonlarni duplikatdan to'ldiradi, lekin mavjud qiymatlarni bekor qilmaydi", async () => {
      const { service, guests } = createService([
        { id: 'primary', tenantId: 't1', phone: '111', email: null },
        {
          id: 'dup',
          tenantId: 't1',
          phone: '999',
          email: 'dup@x.uz',
          nationality: 'UZ',
        },
      ]);
      const result = await service.mergeGuests('t1', 'primary', 'dup');
      expect(result.phone).toBe('111'); // mavjud qiymat saqlanadi
      expect(result.email).toBe('dup@x.uz'); // bo'sh joy to'ldirildi
      expect(result.nationality).toBe('UZ');
      expect(guests.find((g) => g.id === 'dup')).toBeUndefined(); // duplikat o'chirildi
    });

    it("loyalty ballarini qo'shadi va darajani qayta hisoblaydi", async () => {
      const { service } = createService([
        {
          id: 'primary',
          tenantId: 't1',
          loyaltyPoints: 400,
          lifetimePoints: 800,
        },
        {
          id: 'dup',
          tenantId: 't1',
          loyaltyPoints: 300,
          lifetimePoints: 300,
        },
      ]);
      const result = await service.mergeGuests('t1', 'primary', 'dup');
      expect(result.loyaltyPoints).toBe(700);
      expect(result.lifetimePoints).toBe(1100);
      expect(result.loyaltyTier).toBe(LoyaltyTier.SILVER); // 1000 bo'sag'asidan o'tdi
    });

    it("bog'liq yozuvlarni (booking/invoice/pos/loyalty tx) primaryId'ga ko'chiradi", async () => {
      const { service, updateCalls } = createService([
        { id: 'primary', tenantId: 't1' },
        { id: 'dup', tenantId: 't1' },
      ]);
      await service.mergeGuests('t1', 'primary', 'dup');

      const byRepo = (name: string) => updateCalls.find((c) => c.repo === name);
      expect(byRepo('booking')?.criteria).toMatchObject({
        guestId: 'dup',
        tenantId: 't1',
      });
      expect(byRepo('booking')?.partial).toMatchObject({ guestId: 'primary' });
      expect(byRepo('invoice')?.partial).toMatchObject({ guestId: 'primary' });
      expect(byRepo('posOrder')?.partial).toMatchObject({ guestId: 'primary' });
      expect(byRepo('loyaltyTx')?.criteria).toMatchObject({ guestId: 'dup' });
      expect(byRepo('loyaltyTx')?.partial).toMatchObject({
        guestId: 'primary',
      });
    });

    it("izohlarni birlashtiradi (ikkalasida ham bo'lsa)", async () => {
      const { service } = createService([
        { id: 'primary', tenantId: 't1', notes: 'VIP mehmon' },
        { id: 'dup', tenantId: 't1', notes: 'Vegetarian' },
      ]);
      const result = await service.mergeGuests('t1', 'primary', 'dup');
      expect(result.notes).toContain('VIP mehmon');
      expect(result.notes).toContain('Vegetarian');
    });
  });

  // Booking Engine (jonli bron widget'i) mehmon ma'lumotini kiritganda,
  // xuddi shu mehmonning ikki marta (har bir bron uchun alohida) yaratilib
  // ketmasligi uchun `findOrCreateForBooking` mavjud mehmonni telefon/email
  // bo'yicha topishi (yoki topilmasa yangi yaratishi) kerak.
  describe('findOrCreateForBooking', () => {
    it("mavjud mehmonni telefon bo'yicha (format farqidan qat'iy nazar) topadi, yangisini yaratmaydi", async () => {
      const { service, guests, guestRepo } = createService([
        { id: 'g1', tenantId: 't1', phone: '998901234567' },
      ]);
      const result = await service.findOrCreateForBooking('t1', {
        fullName: 'Ism Familiya',
        phone: '+998 90 123-45-67',
      });
      expect(result.id).toBe('g1');
      expect(guestRepo.save).not.toHaveBeenCalled();
      expect(guests).toHaveLength(1);
    });

    it("mavjud mehmonni email bo'yicha (kichik/katta harfdan qat'iy nazar) topadi", async () => {
      const { service } = createService([
        { id: 'g1', tenantId: 't1', email: 'guest@example.com' },
      ]);
      const result = await service.findOrCreateForBooking('t1', {
        fullName: 'Ism Familiya',
        email: 'GUEST@EXAMPLE.COM',
      });
      expect(result.id).toBe('g1');
    });

    it("mos kelmasa (yoki kontakt berilmagan bo'lsa) yangi mehmon yaratadi", async () => {
      const { service, guests } = createService([
        { id: 'g1', tenantId: 't1', phone: '998901234567' },
      ]);
      const result = await service.findOrCreateForBooking('t1', {
        fullName: 'Boshqa Mehmon',
        phone: '998907654321',
      });
      expect(result.id).not.toBe('g1');
      expect(guests).toHaveLength(2);
    });

    it("boshqa tenant'ning mos keluvchi mehmonini hisobga olmaydi (yangi yaratadi)", async () => {
      const { service, guests } = createService([
        { id: 'g1', tenantId: 't2', phone: '998901234567' },
      ]);
      const result = await service.findOrCreateForBooking('t1', {
        fullName: 'Ism Familiya',
        phone: '998901234567',
      });
      expect(result.id).not.toBe('g1');
      expect(guests.filter((g) => g.tenantId === 't1')).toHaveLength(1);
    });
  });

  // 🔬 PROFIL TURI SHARTNOMASI (2026-09-05, mutatsion sinovda topilgan
  // bo'shliq).
  //
  // `findByType` — boshqa modullar ("bu haqiqatan MANBA profilimi?")
  // uchun yagona tekshiruv nuqtasi. Kod izohida aynan shunday
  // yozilgan: "turni har bir chaqiruvchi o'zi tekshirsa, biri unutib
  // qo'yishi muqarrar edi". Lekin tekshiruvning O'ZI hech qanday test
  // bilan qoplanmagan edi.
  //
  // Buzilsa oqibati: bron mehmon profilini "manba" sifatida, yoki
  // turagentni "kompaniya" sifatida qabul qilaverardi — hisobotlar
  // (segment/kanal samaradorligi, turagent komissiyasi) jimgina
  // aralashib ketardi.
  describe('findByType — profil turi tekshiruvi', () => {
    const guest = {
      id: 'g1',
      tenantId: 't1',
      fullName: 'Mehmon',
      profileType: ProfileType.GUEST,
    };

    it("kutilgan turdagi profil qaytariladi", async () => {
      const { service } = createService([guest]);
      const found = await service.findByType('t1', 'g1', ProfileType.GUEST);
      expect(found.id).toBe('g1');
    });

    it.each([
      [ProfileType.SOURCE],
      [ProfileType.COMPANY],
      [ProfileType.TRAVEL_AGENT],
      [ProfileType.GROUP],
    ])("boshqa tur (%s) kutilganda rad etiladi", async (expected) => {
      const { service } = createService([guest]);
      await expect(service.findByType('t1', 'g1', expected)).rejects.toThrow(
        /turida emas/,
      );
    });

    it("mavjud bo'lmagan profil uchun NotFoundException", async () => {
      const { service } = createService([]);
      await expect(
        service.findByType('t1', 'yoq', ProfileType.GUEST),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

});
