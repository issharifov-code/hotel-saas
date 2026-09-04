import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GuestsService } from './guests.service';
import { ProfileType } from './entities/guest.entity';

// Profil turlari (2026-09-04, OPERA Cloud "Manage Profile" referensi).
//
// `guests` jadvali endi jismoniy mehmonni ham, kompaniya/turagent/manba/guruh/
// kontakt profillarini ham saqlaydi. Bu yerdagi testlarning asosiy maqsadi —
// TURLAR BIR-BIRIGA ARALASHIB KETMASLIGI: kompaniyada tug'ilgan sana, mehmonda
// STIR bo'lmasligi; bron mehmonni tanlaganda kompaniya chiqib qolmasligi.
describe('GuestsService — profil turlari', () => {
  function createService(opts: { existing?: Record<string, unknown> } = {}) {
    const saved: Record<string, unknown>[] = [];
    const guestRepo = {
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn((x: Record<string, unknown>) => {
        saved.push(x);
        return Promise.resolve(x);
      }),
      findOneBy: jest.fn().mockResolvedValue(opts.existing ?? null),
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new GuestsService(
      guestRepo as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, guestRepo, saved };
  }

  describe('yaratish', () => {
    it("tur berilmasa profil MEHMON bo'ladi", async () => {
      // Eski chaqiruvchilar (bron widget'i, seed, testlar) `profileType`
      // yubormaydi — ular buzilmasligi kerak.
      const { service, saved } = createService();
      await service.create('t1', { fullName: 'Aziz Karimov' });
      expect(saved[0].profileType).toBe(ProfileType.GUEST);
    });

    it('kompaniya profili STIR va manzil bilan yaratiladi', async () => {
      const { service, saved } = createService();
      await service.create('t1', {
        profileType: ProfileType.COMPANY,
        fullName: 'Orzu Travel MChJ',
        taxId: '301234567',
        address: 'Toshkent, Amir Temur 1',
        city: 'Toshkent',
        contactPerson: 'Nodira Yusupova',
      });
      expect(saved[0]).toMatchObject({
        profileType: ProfileType.COMPANY,
        taxId: '301234567',
        city: 'Toshkent',
      });
    });

    it('🔴 mehmon profiliga STIR yozib bo\'lmaydi', async () => {
      // Jimgina o'chirib tashlash EMAS, xato qaytariladi: foydalanuvchi
      // kiritgan qiymat yo'qolganini bilmay qolmasligi kerak.
      const { service } = createService();
      await expect(
        service.create('t1', {
          fullName: 'Aziz Karimov',
          taxId: '301234567',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("🔴 kompaniya profiliga hujjat raqami yozib bo'lmaydi", async () => {
      const { service } = createService();
      await expect(
        service.create('t1', {
          profileType: ProfileType.COMPANY,
          fullName: 'Orzu Travel MChJ',
          documentNumber: 'AA1234567',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('🔴 komissiya profilda SAQLANMAYDI', async () => {
      // 2026-09-04: komissiya foizi `agencies.commission_pct`da yashaydi —
      // u mulkka bog'liq pul sozlamasi. Ikkala joyda ham bo'lsa, qaysi biri
      // haqiqiy ekani noaniq bo'lib qolardi.
      const { service, saved } = createService();
      await service.create('t1', {
        profileType: ProfileType.TRAVEL_AGENT,
        fullName: 'Silk Road Tours',
      });
      expect(saved[0]).not.toHaveProperty('commissionPct');
    });

    it("bo'sh qiymat cheklovni ishga tushirmaydi", async () => {
      // Frontend to'ldirilmagan maydonlarni ba'zan `''` bilan yuboradi —
      // bu "yozilgan" hisoblanmasligi kerak.
      const { service, saved } = createService();
      await service.create('t1', { fullName: 'Aziz Karimov', taxId: '' });
      expect(saved[0].profileType).toBe(ProfileType.GUEST);
    });
  });

  describe('kontakt profilining tashkiloti', () => {
    it('kompaniyaga bog\'lanishi mumkin', async () => {
      const { service, saved } = createService({
        existing: { id: 'c1', profileType: ProfileType.COMPANY },
      });
      await service.create('t1', {
        profileType: ProfileType.CONTACT,
        fullName: 'Nodira Yusupova',
        parentProfileId: 'c1',
      });
      expect(saved[0].parentProfileId).toBe('c1');
    });

    it('🔴 MEHMON profiliga bog\'lab bo\'lmaydi', async () => {
      const { service } = createService({
        existing: { id: 'g1', profileType: ProfileType.GUEST },
      });
      await expect(
        service.create('t1', {
          profileType: ProfileType.CONTACT,
          fullName: 'Nodira Yusupova',
          parentProfileId: 'g1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("mavjud bo'lmagan tashkilotga bog'lansa 404", async () => {
      const { service } = createService({ existing: undefined });
      await expect(
        service.create('t1', {
          profileType: ProfileType.CONTACT,
          fullName: 'Nodira Yusupova',
          parentProfileId: '00000000-0000-0000-0000-000000000001',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('bron uchun mehmon topish', () => {
    it("🔴 FAQAT mehmon turidagi profillar orasidan izlaydi", async () => {
      // Kompaniyaning umumiy telefoni mehmonnikiga to'g'ri kelib qolsa,
      // bron egasi sifatida kompaniya qaytib qolishi mumkin edi.
      const { service, guestRepo } = createService();
      await service.findOrCreateForBooking('t1', {
        fullName: 'Aziz Karimov',
        phone: '+998901112233',
      });
      expect(guestRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', profileType: ProfileType.GUEST },
      });
    });
  });

  describe('birlashtirish', () => {
    it("🔴 turli turdagi profillarni birlashtirib bo'lmaydi", async () => {
      const { service, guestRepo } = createService();
      guestRepo.findOneBy = jest
        .fn()
        .mockResolvedValueOnce({ id: 'a', profileType: ProfileType.GUEST })
        .mockResolvedValueOnce({ id: 'b', profileType: ProfileType.COMPANY });

      await expect(service.mergeGuests('t1', 'a', 'b')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
