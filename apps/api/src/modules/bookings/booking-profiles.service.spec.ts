import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { ProfileType } from '../guests/entities/guest.entity';

// Bronning PROFILLARGA bog'lanishi (2026-09-04).
//
// Ikkita qoida sinaladi va ikkalasi ham "turlar aralashib ketmasin" degan
// bitta maqsadga xizmat qiladi:
//   1. bron egasi FAQAT jismoniy mehmon profili bo'lishi mumkin,
//   2. bron manbasi FAQAT manba profili bo'lishi mumkin.
//
// Frontend ikkalasini ham filtrlaydi — lekin API o'zi tekshirmasa, filtr
// shunchaki taklif bo'lib qolardi.
describe('BookingsService — profil turlari', () => {
  function createService(opts: { profileTypes?: Record<string, ProfileType> } = {}) {
    const saved: Record<string, unknown>[] = [];
    const bookingQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      // Bo'sh = to'qnashuv yo'q; bu testlar sana mantig'ini emas, profil
      // turlarini sinaydi.
      getOne: jest.fn().mockResolvedValue(null),
    };
    const bookingRepo = {
      createQueryBuilder: jest.fn(() => bookingQueryBuilder),
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn((x: Record<string, unknown>) => {
        saved.push(x);
        return Promise.resolve({ ...x, id: 'booking-1' });
      }),
    };

    // Har bir profil uchun tur: testda `profileTypes` bilan beriladi,
    // berilmasa profil kutilgan turda deb hisoblanadi (baxtli yo'l).
    const guestsService = {
      findById: jest.fn((_t: string, id: string) => Promise.resolve({ id })),
      findByType: jest.fn((_t: string, id: string, expected: ProfileType) => {
        const actual = opts.profileTypes?.[id] ?? expected;
        if (actual !== expected) {
          return Promise.reject(
            new BadRequestException('Bu profil kerakli turda emas'),
          );
        }
        return Promise.resolve({ id, profileType: actual });
      }),
    };

    const service = new BookingsService(
      bookingRepo as never,
      { update: jest.fn() } as never,
      {
        findOneBy: jest
          .fn()
          .mockResolvedValue({ id: 'rt-1', basePrice: '500000' }),
      } as never,
      {
        findById: jest.fn().mockResolvedValue({
          id: 'room-1',
          roomTypeId: 'rt-1',
          roomNumber: '101',
        }),
      } as never,
      { findById: jest.fn() } as never,
      { assertBookingAllowed: jest.fn().mockResolvedValue(undefined) } as never,
      guestsService as never,
      {} as never,
      {} as never,
      {} as never,
      { findById: jest.fn() } as never,
      { findById: jest.fn() } as never,
    );
    return { service, guestsService, saved };
  }

  const baseDto = {
    roomId: 'room-1',
    guestId: 'guest-1',
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
  };

  it('bron egasi MEHMON turida ekani tekshiriladi', async () => {
    const { service, guestsService } = createService();
    await service.create('t1', 'p1', baseDto);
    expect(guestsService.findByType).toHaveBeenCalledWith(
      't1',
      'guest-1',
      ProfileType.GUEST,
    );
  });

  it("🔴 KOMPANIYA profilini bron egasi qilib bo'lmaydi", async () => {
    // Aynan shu holat uchun tekshiruv qo'shilgan: kompaniya profili bron
    // egasi bo'lsa, check-in, folio va sodiqlik mantig'i ma'nosiz bo'lardi.
    const { service } = createService({
      profileTypes: { 'guest-1': ProfileType.COMPANY },
    });
    await expect(service.create('t1', 'p1', baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('manba profili MANBA turida ekani tekshiriladi va saqlanadi', async () => {
    const { service, guestsService, saved } = createService();
    await service.create('t1', 'p1', { ...baseDto, sourceProfileId: 'src-1' });
    expect(guestsService.findByType).toHaveBeenCalledWith(
      't1',
      'src-1',
      ProfileType.SOURCE,
    );
    expect(saved[0].sourceProfileId).toBe('src-1');
  });

  it("🔴 TURAGENT profilini manba sifatida qo'yib bo'lmaydi", async () => {
    const { service } = createService({
      profileTypes: { 'src-1': ProfileType.TRAVEL_AGENT },
    });
    await expect(
      service.create('t1', 'p1', { ...baseDto, sourceProfileId: 'src-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("manba berilmasa null bo'ladi (majburiy emas)", async () => {
    const { service, saved } = createService();
    await service.create('t1', 'p1', baseDto);
    expect(saved[0].sourceProfileId).toBeNull();
  });
});
