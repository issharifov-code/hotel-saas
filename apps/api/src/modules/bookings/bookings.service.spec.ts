import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingSource, BookingStatus } from './entities/booking.entity';
import { RoomStatus } from '../rooms/entities/room.entity';

interface CreatedBookingArg {
  totalAmount: string;
  status: BookingStatus;
}

// Bu testlar BookingsService.create — bron yaratishda sana oralig'i to'qnashuvini
// (bir xil xonaga bir vaqtda ikkita band bo'lishini) oldini olish mantig'ini
// sinaydi. Bu PMS'ning eng muhim invarianti: ikki faol bron bir xonada
// bir-biriga ustma-ust tushmasligi kerak.
describe("BookingsService.create — sana to'qnashuvi", () => {
  function createService(conflict: unknown) {
    const bookingQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(conflict),
    };
    const savedBooking = { id: 'booking-1' };
    const bookingRepo = {
      createQueryBuilder: jest.fn(() => bookingQueryBuilder),
      create: jest.fn((data: CreatedBookingArg) => data),
      save: jest.fn().mockResolvedValue(savedBooking),
    };
    const roomRepo = { update: jest.fn() };
    const roomTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'rt-1', basePrice: '500000' }),
    };
    const roomsService = {
      findById: jest.fn().mockResolvedValue({
        id: 'room-1',
        roomTypeId: 'rt-1',
        roomNumber: '101',
      }),
    };
    const ratePlansService = {
      findById: jest.fn(),
    };
    const ratePlanRestrictionsService = {
      assertBookingAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const guestsService = {
      findById: jest.fn().mockResolvedValue({ id: 'guest-1' }),
      // 2026-09-04: bron egasi FAQAT mehmon profili bo'lishi kerak, manba
      // esa MANBA turida — servis buni `findByType` orqali tekshiradi.
      findByType: jest
        .fn()
        .mockImplementation((_t: string, id: string, type: string) =>
          Promise.resolve({ id, profileType: type }),
        ),
    };
    const housekeepingService = {};
    const invoicingService = {};
    const bookingGroupRepo = {};
    const agenciesService = { findById: jest.fn() };
    const cityLedgerService = { findById: jest.fn() };

    const agencyCommissionsService = { accrueForBooking: jest.fn() };
    // 2026-09-05 (audit №12): bron valyutasi mulkdan olinadi.
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', currency: 'UZS' }),
    };
    const service = new BookingsService(
      bookingRepo as never,
      roomRepo as never,
      roomTypeRepo as never,
      roomsService as never,
      ratePlansService as never,
      ratePlanRestrictionsService as never,
      guestsService as never,
      housekeepingService as never,
      invoicingService as never,
      bookingGroupRepo as never,
      propertyRepo as never,
      agenciesService as never,
      agencyCommissionsService as never,
      cityLedgerService as never,
    );
    return {
      service,
      bookingRepo,
      bookingQueryBuilder,
      ratePlansService,
      ratePlanRestrictionsService,
      agenciesService,
      cityLedgerService,
      guestsService,
      propertyRepo,
    };
  }

  const dto = {
    roomId: 'room-1',
    guestId: 'guest-1',
    checkIn: '2026-09-01',
    checkOut: '2026-09-05',
    source: BookingSource.DIRECT,
  };

  it("check-out check-in dan oldin (yoki teng) bo'lsa xato tashlaydi", async () => {
    const { service } = createService(null);
    await expect(
      service.create('t1', 'p1', {
        ...dto,
        checkIn: '2026-09-05',
        checkOut: '2026-09-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("shu xonada to'qnashadigan faol bron mavjud bo'lsa ConflictException tashlaydi", async () => {
    const { service, bookingRepo } = createService({
      id: 'existing-1',
      checkIn: '2026-08-30',
      checkOut: '2026-09-03',
    });

    await expect(service.create('t1', 'p1', dto)).rejects.toThrow(
      ConflictException,
    );
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it("to'qnashuv yo'q bo'lsa bronni yaratadi va tunlar soniga qarab narxni hisoblaydi", async () => {
    const { service, bookingRepo } = createService(null);

    const result = await service.create('t1', 'p1', dto);

    expect(result).toEqual({ id: 'booking-1' });
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    const createdArg = bookingRepo.create.mock.calls[0][0];
    // 2026-09-01 -> 2026-09-05 = 4 tun * 500000 = 2000000.00
    expect(createdArg.totalAmount).toBe('2000000.00');
    expect(createdArg.status).toBe(BookingStatus.CONFIRMED);
  });

  it("to'qnashuvni tekshirishda bekor qilingan/checkout bo'lgan bronlar band deb hisoblanmaydi (faqat faol holatlar so'raladi)", async () => {
    const { service, bookingQueryBuilder } = createService(null);
    await service.create('t1', 'p1', dto);

    // assertRoomAvailable BLOCKING_STATUSES bilan filtr qo'yishini tekshiramiz —
    // andWhere chaqiruvlaridan birida statuses IN sharti bo'lishi kerak.
    const andWhereCalls = bookingQueryBuilder.andWhere.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(
      andWhereCalls.some((sql: string) => sql.includes('booking.status IN')),
    ).toBe(true);
  });

  it("berilgan totalAmount mavjud bo'lsa, avtomatik hisoblash o'rniga o'shani ishlatadi", async () => {
    const { service, bookingRepo } = createService(null);
    await service.create('t1', 'p1', { ...dto, totalAmount: '999.99' });
    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.totalAmount).toBe('999.99');
  });

  it("ratePlanId berilsa, RoomType.basePrice o'rniga rejaning nightlyPrice'idan hisoblaydi", async () => {
    const { service, bookingRepo, ratePlansService } = createService(null);
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-1', // xonaning roomTypeId'siga mos
      nightlyPrice: '650000',
    });

    await service.create('t1', 'p1', { ...dto, ratePlanId: 'rp-1' });

    const createdArg = bookingRepo.create.mock.calls[0][0];
    // 4 tun * 650000 = 2600000.00 (500000 emas — bazaviy narx e'tiborga olinmadi)
    expect(createdArg.totalAmount).toBe('2600000.00');
    expect(createdArg.ratePlanId).toBe('rp-1');
  });

  it('ratePlanId berilsa, cheklov (masalan Stop Sell) bronni rad etadi', async () => {
    const { service, ratePlansService, ratePlanRestrictionsService } =
      createService(null);
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-1',
      nightlyPrice: '650000',
    });
    ratePlanRestrictionsService.assertBookingAllowed.mockRejectedValue(
      new ConflictException('Stop Sell'),
    );

    await expect(
      service.create('t1', 'p1', { ...dto, ratePlanId: 'rp-1' }),
    ).rejects.toThrow(ConflictException);
    expect(
      ratePlanRestrictionsService.assertBookingAllowed,
    ).toHaveBeenCalledWith('rp-1', dto.checkIn, dto.checkOut, 4);
  });

  it("narx rejasi boshqa xona turiga tegishli bo'lsa xato tashlaydi", async () => {
    const { service, ratePlansService } = createService(null);
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-BOSHQA', // xonaning roomTypeId'siga mos EMAS
      nightlyPrice: '650000',
    });

    await expect(
      service.create('t1', 'p1', { ...dto, ratePlanId: 'rp-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("marketSegment berilmasa 'other' ga tushadi, berilsa saqlanadi", async () => {
    const { service, bookingRepo } = createService(null);
    await service.create('t1', 'p1', dto);
    expect(bookingRepo.create.mock.calls[0][0].marketSegment).toBe('other');

    await service.create('t1', 'p1', {
      ...dto,
      marketSegment: 'corporate' as never,
    });
    expect(bookingRepo.create.mock.calls[1][0].marketSegment).toBe('corporate');
  });

  it("agencyId berilsa, agentlik mavjudligini tekshiradi va marketSegment'ni 'travel_agent'ga o'rnatadi", async () => {
    const { service, bookingRepo, agenciesService } = createService(null);
    agenciesService.findById.mockResolvedValue({ id: 'agency-1' });

    await service.create('t1', 'p1', { ...dto, agencyId: 'agency-1' });

    expect(agenciesService.findById).toHaveBeenCalledWith(
      't1',
      'p1',
      'agency-1',
    );
    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.agencyId).toBe('agency-1');
    expect(createdArg.marketSegment).toBe('travel_agent');
  });

  it('agencyId va marketSegment ikkalasi ham berilsa, aniq berilgan marketSegment ustunlik qiladi', async () => {
    const { service, bookingRepo, agenciesService } = createService(null);
    agenciesService.findById.mockResolvedValue({ id: 'agency-1' });

    await service.create('t1', 'p1', {
      ...dto,
      agencyId: 'agency-1',
      marketSegment: 'corporate' as never,
    });

    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.marketSegment).toBe('corporate');
  });

  it("mavjud bo'lmagan agencyId berilsa xato tashlaydi", async () => {
    const { service, agenciesService } = createService(null);
    agenciesService.findById.mockRejectedValue(
      new NotFoundException('Agentlik topilmadi'),
    );

    await expect(
      service.create('t1', 'p1', { ...dto, agencyId: 'yoq-agency' }),
    ).rejects.toThrow(NotFoundException);
  });

  it("corporateAccountId berilsa, hisob mavjudligini tekshiradi va marketSegment'ni 'corporate'ga o'rnatadi", async () => {
    const { service, bookingRepo, cityLedgerService } = createService(null);
    cityLedgerService.findById.mockResolvedValue({ id: 'ca-1' });

    await service.create('t1', 'p1', { ...dto, corporateAccountId: 'ca-1' });

    expect(cityLedgerService.findById).toHaveBeenCalledWith('t1', 'p1', 'ca-1');
    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.corporateAccountId).toBe('ca-1');
    expect(createdArg.marketSegment).toBe('corporate');
  });

  it('corporateAccountId va marketSegment ikkalasi ham berilsa, aniq berilgan marketSegment ustunlik qiladi', async () => {
    const { service, bookingRepo, cityLedgerService } = createService(null);
    cityLedgerService.findById.mockResolvedValue({ id: 'ca-1' });

    await service.create('t1', 'p1', {
      ...dto,
      corporateAccountId: 'ca-1',
      marketSegment: 'other' as never,
    });

    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.marketSegment).toBe('other');
  });

  it("mavjud bo'lmagan corporateAccountId berilsa xato tashlaydi", async () => {
    const { service, cityLedgerService } = createService(null);
    cityLedgerService.findById.mockRejectedValue(
      new NotFoundException('Korporativ hisob topilmadi'),
    );

    await expect(
      service.create('t1', 'p1', { ...dto, corporateAccountId: 'yoq-hisob' }),
    ).rejects.toThrow(NotFoundException);
  });

  // --- Kontakt shaxs (2026-09-05) -------------------------------------
  // Kontakt profili tashkilotga `parentProfileId` orqali bog'lanadi;
  // agentlik/korporativ hisob esa o'z `profileId`siga ega. Tekshiruv aynan
  // shu ikkisini taqqoslaydi.

  function withContact(contact: Record<string, unknown> | null) {
    const ctx = createService(null);
    ctx.guestsService.findByType.mockImplementation(
      (_t: string, id: string, type: string) => {
        if (type === 'contact') {
          if (!contact) throw new BadRequestException('Kontakt emas');
          return Promise.resolve({ id, profileType: type, ...contact });
        }
        return Promise.resolve({ id, profileType: type });
      },
    );
    return ctx;
  }

  it('kontakt tashkilot agentlik profiliga mos kelsa saqlanadi', async () => {
    const { service, bookingRepo, agenciesService } = withContact({
      fullName: 'Dilshod',
      parentProfileId: 'prof-agentlik',
    });
    agenciesService.findById.mockResolvedValue({
      id: 'ag1',
      profileId: 'prof-agentlik',
    });

    await service.create('t1', 'p1', {
      ...dto,
      agencyId: 'ag1',
      contactProfileId: 'kontakt-1',
    });
    expect(bookingRepo.create.mock.calls[0][0].contactProfileId).toBe('kontakt-1');
  });

  it("🔴 boshqa tashkilotning kontakti rad etiladi", async () => {
    const { service, agenciesService } = withContact({
      fullName: 'Aziza',
      parentProfileId: 'prof-boshqa-kompaniya',
    });
    agenciesService.findById.mockResolvedValue({
      id: 'ag1',
      profileId: 'prof-agentlik',
    });

    await expect(
      service.create('t1', 'p1', {
        ...dto,
        agencyId: 'ag1',
        contactProfileId: 'kontakt-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('korporativ hisob profiliga mos kelsa ham saqlanadi', async () => {
    const { service, bookingRepo, cityLedgerService } = withContact({
      fullName: 'Sardor',
      parentProfileId: 'prof-kompaniya',
    });
    cityLedgerService.findById.mockResolvedValue({
      id: 'ca1',
      profileId: 'prof-kompaniya',
    });

    await service.create('t1', 'p1', {
      ...dto,
      corporateAccountId: 'ca1',
      contactProfileId: 'kontakt-1',
    });
    expect(bookingRepo.create.mock.calls[0][0].contactProfileId).toBe('kontakt-1');
  });

  it("mustaqil kontakt (tashkilotsiz) har qanday bronga ulanadi", async () => {
    const { service, bookingRepo, agenciesService } = withContact({
      fullName: "To'y tashkilotchisi",
      parentProfileId: null,
    });
    agenciesService.findById.mockResolvedValue({
      id: 'ag1',
      profileId: 'prof-agentlik',
    });

    await service.create('t1', 'p1', {
      ...dto,
      agencyId: 'ag1',
      contactProfileId: 'kontakt-1',
    });
    expect(bookingRepo.create.mock.calls[0][0].contactProfileId).toBe('kontakt-1');
  });

  it('tashkilotsiz bronda kontakt tekshirilmaydi', async () => {
    const { service, bookingRepo } = withContact({
      fullName: 'Dilshod',
      parentProfileId: 'prof-agentlik',
    });

    await service.create('t1', 'p1', { ...dto, contactProfileId: 'kontakt-1' });
    expect(bookingRepo.create.mock.calls[0][0].contactProfileId).toBe('kontakt-1');
  });

  // 🔴 2026-09-05 (audit №12): valyuta `'UZS'` deb qattiq yozilgan edi.
  it("bron valyutasi mulkning valyutasidan olinadi", async () => {
    const { service, bookingRepo, propertyRepo } = createService(null);
    propertyRepo.findOne.mockResolvedValue({ id: 'p1', currency: 'USD' });

    await service.create('t1', 'p1', dto);

    expect(bookingRepo.create.mock.calls[0][0].currency).toBe('USD');
  });

  it("DTO'da valyuta berilsa u ustunlik qiladi", async () => {
    const { service, bookingRepo, propertyRepo } = createService(null);
    propertyRepo.findOne.mockResolvedValue({ id: 'p1', currency: 'USD' });

    await service.create('t1', 'p1', { ...dto, currency: 'EUR' });

    expect(bookingRepo.create.mock.calls[0][0].currency).toBe('EUR');
  });

  it("kontakt berilmasa null yoziladi", async () => {
    const { service, bookingRepo } = createService(null);
    await service.create('t1', 'p1', dto);
    expect(bookingRepo.create.mock.calls[0][0].contactProfileId).toBeNull();
  });

  it("🔴 kontakt o'rniga mehmon profili berilsa rad etiladi", async () => {
    const { service, guestsService } = createService(null);
    // Servis `findByType(..., CONTACT)` chaqiradi — turi mos kelmasa
    // GuestsService o'zi BadRequest tashlaydi.
    guestsService.findByType.mockImplementation(
      (_t: string, id: string, type: string) => {
        if (type === 'contact') {
          return Promise.reject(
            new BadRequestException('Bu profil "Kontakt" turida emas'),
          );
        }
        return Promise.resolve({ id, profileType: type });
      },
    );

    await expect(
      service.create('t1', 'p1', { ...dto, contactProfileId: 'mehmon-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// Bu testlar Booking Engine (jonli, autentifikatsiyasiz bron widget'i) uchun
// qo'shilgan `createFromWebsite`/`confirm`/`countAvailableRoomsOfType`
// metodlarini sinaydi: mehmon ANIQ xonani emas, faqat XONA TURINI tanlaydi —
// birinchi bo'sh (va "out_of_order" bo'lmagan) xona avtomatik tayinlanishi kerak.
describe('BookingsService.createFromWebsite / confirm — Booking Engine', () => {
  function createWebsiteService(
    params: {
      rooms?: Array<{ id: string; status?: RoomStatus }>;
      conflictByRoomId?: Record<
        string,
        { id: string; checkIn: string; checkOut: string } | null
      >;
    } = {},
  ) {
    const rooms = params.rooms ?? [
      { id: 'room-1', status: RoomStatus.AVAILABLE },
    ];
    const conflictByRoomId = params.conflictByRoomId ?? {};

    // `listAvailableRoomsOfType` endi HAR BIR nomzod xona uchun alohida
    // `getOne` so'rovi o'rniga, barcha nomzod xonalarning id'larini BITTA
    // `where('room_id IN (...)')` + `getRawMany()` so'rovi bilan tekshiradi
    // (N+1 tuzatish, 2026-09-01 sayqal auditi). Shuning uchun mock endi
    // `where()`da ushlangan `roomIds` massivini `conflictByRoomId` bilan
    // solishtirib, to'qnashuvchi (conflict qiymati null bo'lmagan) id'larni
    // qaytaradi — natija xuddi avvalgi per-room simulyatsiya bilan bir xil.
    let capturedRoomIds: string[] = [];
    const bookingQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(() =>
        Promise.resolve(
          capturedRoomIds
            .filter((id) => conflictByRoomId[id])
            .map((id) => ({ roomId: id })),
        ),
      ),
    };
    bookingQueryBuilder.where.mockImplementation(
      (_sql: unknown, args: unknown) => {
        capturedRoomIds = (args as { roomIds: string[] }).roomIds;
        return bookingQueryBuilder;
      },
    );

    const bookingRepo = {
      createQueryBuilder: jest.fn(() => bookingQueryBuilder),
      create: jest.fn((data: unknown) => ({
        id: 'booking-1',
        ...(data as object),
      })),
      // Haqiqiy TypeORM `.save()` kabi — kiritilgan entity'ni (mutatsiyalar
      // bilan birga) qaytaradi, `confirm()` kabi metodlar buni tekshiradi.
      save: jest.fn((b: unknown) => Promise.resolve(b)),
      findOne: jest.fn(),
    };
    const roomRepo = {
      find: jest.fn().mockResolvedValue(rooms),
    };
    const roomTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'rt-1', basePrice: '500000' }),
    };
    const roomsService = {};
    const ratePlansService = { findById: jest.fn() };
    const ratePlanRestrictionsService = {
      assertBookingAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const guestsService = {
      findById: jest.fn().mockResolvedValue({ id: 'guest-1' }),
      // 2026-09-04: bron egasi FAQAT mehmon profili bo'lishi kerak, manba
      // esa MANBA turida — servis buni `findByType` orqali tekshiradi.
      findByType: jest
        .fn()
        .mockImplementation((_t: string, id: string, type: string) =>
          Promise.resolve({ id, profileType: type }),
        ),
    };
    const housekeepingService = {};
    const invoicingService = {};
    const bookingGroupRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((g: { id?: string }) =>
        Promise.resolve({ id: g.id ?? 'group-1', ...g }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const agenciesService = { findById: jest.fn() };
    const cityLedgerService = { findById: jest.fn() };

    const agencyCommissionsService = { accrueForBooking: jest.fn() };
    // 2026-09-05 (audit №12): bron valyutasi mulkdan olinadi.
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', currency: 'UZS' }),
    };
    const service = new BookingsService(
      bookingRepo as never,
      roomRepo as never,
      roomTypeRepo as never,
      roomsService as never,
      ratePlansService as never,
      ratePlanRestrictionsService as never,
      guestsService as never,
      housekeepingService as never,
      invoicingService as never,
      bookingGroupRepo as never,
      propertyRepo as never,
      agenciesService as never,
      agencyCommissionsService as never,
      cityLedgerService as never,
    );
    return {
      service,
      bookingRepo,
      roomRepo,
      ratePlansService,
      ratePlanRestrictionsService,
      bookingGroupRepo,
      guestsService,
      agenciesService,
    };
  }

  const dto = {
    roomTypeId: 'rt-1',
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
    guestId: 'guest-1',
  };

  it("check-out check-in dan oldin (yoki teng) bo'lsa xato tashlaydi", async () => {
    const { service } = createWebsiteService();
    await expect(
      service.createFromWebsite('t1', 'p1', {
        ...dto,
        checkIn: '2026-10-03',
        checkOut: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("'out_of_order' xonalarni chetlab o'tib, birinchi bo'sh xonani tanlaydi", async () => {
    const { service, bookingRepo } = createWebsiteService({
      rooms: [
        { id: 'room-broken', status: RoomStatus.OUT_OF_ORDER },
        { id: 'room-ok', status: RoomStatus.AVAILABLE },
      ],
    });
    await service.createFromWebsite('t1', 'p1', dto);
    expect(bookingRepo.create.mock.calls[0][0].roomId).toBe('room-ok');
  });

  it("band (to'qnashadigan) xonalarni o'tkazib yuborib, birinchi bo'sh xonani tanlaydi", async () => {
    const { service, bookingRepo } = createWebsiteService({
      rooms: [
        { id: 'room-busy', status: RoomStatus.AVAILABLE },
        { id: 'room-free', status: RoomStatus.AVAILABLE },
      ],
      conflictByRoomId: {
        'room-busy': {
          id: 'existing-1',
          checkIn: '2026-09-30',
          checkOut: '2026-10-02',
        },
      },
    });
    await service.createFromWebsite('t1', 'p1', dto);
    expect(bookingRepo.create.mock.calls[0][0].roomId).toBe('room-free');
  });

  it("shu turdagi bo'sh xona bo'lmasa ConflictException tashlaydi", async () => {
    const { service } = createWebsiteService({
      rooms: [{ id: 'room-busy', status: RoomStatus.AVAILABLE }],
      conflictByRoomId: {
        'room-busy': {
          id: 'existing-1',
          checkIn: '2026-09-30',
          checkOut: '2026-10-02',
        },
      },
    });
    await expect(service.createFromWebsite('t1', 'p1', dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it("holat PENDING, manba WEBSITE bo'lib yaratiladi", async () => {
    const { service, bookingRepo } = createWebsiteService();
    await service.createFromWebsite('t1', 'p1', dto);
    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.status).toBe(BookingStatus.PENDING);
    expect(createdArg.source).toBe(BookingSource.WEBSITE);
  });

  it("narx rejasi boshqa xona turiga tegishli bo'lsa xato tashlaydi", async () => {
    const { service, ratePlansService } = createWebsiteService();
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-BOSHQA',
      nightlyPrice: '650000',
      isActive: true,
    });
    await expect(
      service.createFromWebsite('t1', 'p1', { ...dto, ratePlanId: 'rp-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("narx rejasi endi faol bo'lmasa xato tashlaydi", async () => {
    const { service, ratePlansService } = createWebsiteService();
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-1',
      nightlyPrice: '650000',
      isActive: false,
    });
    await expect(
      service.createFromWebsite('t1', 'p1', { ...dto, ratePlanId: 'rp-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('narx rejasi cheklovi (masalan Min Length of Stay) bronni rad etadi', async () => {
    const { service, ratePlansService, ratePlanRestrictionsService } =
      createWebsiteService();
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-1',
      nightlyPrice: '650000',
      isActive: true,
    });
    ratePlanRestrictionsService.assertBookingAllowed.mockRejectedValue(
      new BadRequestException('Min Length of Stay'),
    );
    await expect(
      service.createFromWebsite('t1', 'p1', { ...dto, ratePlanId: 'rp-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("cheklovga zid bo'lmagan narx rejali bron muvaffaqiyatli yaratiladi", async () => {
    const { service, ratePlansService, ratePlanRestrictionsService } =
      createWebsiteService();
    ratePlansService.findById.mockResolvedValue({
      id: 'rp-1',
      roomTypeId: 'rt-1',
      nightlyPrice: '650000',
      isActive: true,
    });
    const result = await service.createFromWebsite('t1', 'p1', {
      ...dto,
      ratePlanId: 'rp-1',
    });
    expect(result).toBeDefined();
    expect(ratePlanRestrictionsService.assertBookingAllowed).toHaveBeenCalled();
  });

  it("confirm: PENDING bronni CONFIRMED holatiga o'tkazadi", async () => {
    const { service, bookingRepo } = createWebsiteService();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.PENDING,
    });
    const result = await service.confirm('t1', 'p1', 'b1');
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(bookingRepo.save).toHaveBeenCalled();
  });

  it("confirm: PENDING bo'lmagan bronni tasdiqlashga urinilsa ConflictException tashlaydi", async () => {
    const { service, bookingRepo } = createWebsiteService();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.CONFIRMED,
    });
    await expect(service.confirm('t1', 'p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
  });

  it("countAvailableRoomsOfType: sana oralig'i noto'g'ri bo'lsa 0 qaytaradi (DB'ga murojaat qilmasdan)", async () => {
    const { service, roomRepo } = createWebsiteService();
    const count = await service.countAvailableRoomsOfType(
      't1',
      'p1',
      'rt-1',
      '2026-10-03',
      '2026-10-01',
    );
    expect(count).toBe(0);
    expect(roomRepo.find).not.toHaveBeenCalled();
  });

  it("countAvailableRoomsOfType: bo'sh xonalar sonini to'g'ri qaytaradi", async () => {
    const { service } = createWebsiteService({
      rooms: [
        { id: 'room-1', status: RoomStatus.AVAILABLE },
        { id: 'room-2', status: RoomStatus.OUT_OF_ORDER },
        { id: 'room-3', status: RoomStatus.AVAILABLE },
      ],
    });
    const count = await service.countAvailableRoomsOfType(
      't1',
      'p1',
      'rt-1',
      '2026-10-01',
      '2026-10-03',
    );
    expect(count).toBe(2); // room-2 out_of_order bo'lgani uchun hisoblanmaydi
  });

  it("N+1 tuzatish: to'qnashuv so'rovi nomzod xonalar soniga qaramay FAQAT BIR MARTA chaqiriladi", async () => {
    // Sayqal auditi (2026-09-01) topilmasi: avval har bir nomzod xona uchun
    // alohida so'rov yuborilardi (N+1) — bu test aynan shu regressiyaning
    // oldini oladi: 12 ta xona bo'lsa ham `createQueryBuilder` bir marta
    // chaqirilishi kerak, 12 marta emas.
    const manyRooms = Array.from({ length: 12 }, (_, i) => ({
      id: `room-${i + 1}`,
      status: RoomStatus.AVAILABLE,
    }));
    const { service, bookingRepo } = createWebsiteService({ rooms: manyRooms });
    const count = await service.countAvailableRoomsOfType(
      't1',
      'p1',
      'rt-1',
      '2026-10-01',
      '2026-10-03',
    );
    expect(count).toBe(12);
    expect(bookingRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});

// Guruh/blok bron — `createGroup`/`addRoomToGroup`/`listGroups`/`findGroupById`
// metodlarini sinaydi. `createRoomForGroup` (xususiy) `createFromWebsite` bilan
// bir xil "xona turi tanlanadi, birinchi bo'sh xona avtomatik tayinlanadi"
// naqshini qayta ishlatadi, shuning uchun shu yerda ham bir xil
// `createWebsiteService` yordamchisidan foydalaniladi.
describe('BookingsService.createGroup / addRoomToGroup — Guruh bron', () => {
  function createGroupService(
    params: {
      rooms?: Array<{ id: string; status?: RoomStatus }>;
    } = {},
  ) {
    const rooms = params.rooms ?? [
      { id: 'room-1', status: RoomStatus.AVAILABLE },
    ];
    // `listAvailableRoomsOfType` bitta batched `getRawMany()` so'rov bilan
    // to'qnashuvlarni tekshiradi (N+1 tuzatish) — bo'sh massiv qaytarish
    // "hech qanday to'qnashuv yo'q" degani (avvalgi `getOne: null` bilan bir xil).
    const bookingQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const bookingRepo = {
      createQueryBuilder: jest.fn(() => bookingQueryBuilder),
      create: jest.fn((data: unknown) => ({
        id: 'booking-1',
        ...(data as object),
      })),
      save: jest.fn((b: unknown) => Promise.resolve(b)),
    };
    const roomRepo = { find: jest.fn().mockResolvedValue(rooms) };
    const roomTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'rt-1', basePrice: '500000' }),
    };
    const roomsService = {};
    const ratePlansService = { findById: jest.fn() };
    const ratePlanRestrictionsService = {
      assertBookingAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const guestsService = {
      findById: jest.fn().mockResolvedValue({ id: 'guest-1' }),
      // 2026-09-04: bron egasi FAQAT mehmon profili bo'lishi kerak, manba
      // esa MANBA turida — servis buni `findByType` orqali tekshiradi.
      findByType: jest
        .fn()
        .mockImplementation((_t: string, id: string, type: string) =>
          Promise.resolve({ id, profileType: type }),
        ),
    };
    const housekeepingService = {};
    const invoicingService = {};
    const bookingGroupRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((g: { id?: string }) =>
        Promise.resolve({ id: 'group-1', ...g }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const agenciesService = { findById: jest.fn() };
    const cityLedgerService = { findById: jest.fn() };

    const agencyCommissionsService = { accrueForBooking: jest.fn() };
    // 2026-09-05 (audit №12): bron valyutasi mulkdan olinadi.
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', currency: 'UZS' }),
    };
    const service = new BookingsService(
      bookingRepo as never,
      roomRepo as never,
      roomTypeRepo as never,
      roomsService as never,
      ratePlansService as never,
      ratePlanRestrictionsService as never,
      guestsService as never,
      housekeepingService as never,
      invoicingService as never,
      bookingGroupRepo as never,
      propertyRepo as never,
      agenciesService as never,
      agencyCommissionsService as never,
      cityLedgerService as never,
    );
    return {
      service,
      bookingRepo,
      bookingGroupRepo,
      guestsService,
      ratePlansService,
      ratePlanRestrictionsService,
      agenciesService,
    };
  }

  const groupDto = {
    groupName: 'ACME konferensiyasi',
    companyName: 'ACME MChJ',
    checkIn: '2026-11-01',
    checkOut: '2026-11-03',
    rooms: [
      { roomTypeId: 'rt-1', guestId: 'guest-1' },
      { roomTypeId: 'rt-1', guestId: 'guest-2' },
    ],
  };

  it("check-out check-in dan oldin (yoki teng) bo'lsa xato tashlaydi", async () => {
    const { service } = createGroupService();
    await expect(
      service.createGroup('t1', 'p1', 'user-1', {
        ...groupDto,
        checkIn: '2026-11-03',
        checkOut: '2026-11-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("guruhni yaratadi va har bir qator uchun alohida, groupId'ga bog'langan bron yasaydi", async () => {
    const { service, bookingRepo, bookingGroupRepo } = createGroupService({
      rooms: [
        { id: 'room-1', status: RoomStatus.AVAILABLE },
        { id: 'room-2', status: RoomStatus.AVAILABLE },
      ],
    });

    const group = await service.createGroup('t1', 'p1', 'user-1', groupDto);

    expect(bookingGroupRepo.save).toHaveBeenCalledTimes(1);
    expect(group.id).toBe('group-1');
    expect(bookingRepo.save).toHaveBeenCalledTimes(2);
    const created1 = bookingRepo.create.mock.calls[0][0];
    const created2 = bookingRepo.create.mock.calls[1][0];
    expect(created1.groupId).toBe('group-1');
    expect(created2.groupId).toBe('group-1');
    expect(created1.marketSegment).toBe('group');
    expect(created1.guestId).toBe('guest-1');
    expect(created2.guestId).toBe('guest-2');
  });

  it("N+1 tuzatish: har bir xona qatori uchun to'qnashuv so'rovi nomzod xonalar soniga qarab ko'paymaydi", async () => {
    // 10 ta nomzod xona bo'lsa ham, guruhdagi har bir qator (bu yerda 2 ta)
    // uchun `listAvailableRoomsOfType` bitta batched so'rov qiladi — jami
    // `createQueryBuilder` chaqiruvi qatorlar soniga teng bo'lishi kerak
    // (2), 2×10 emas.
    const manyRooms = Array.from({ length: 10 }, (_, i) => ({
      id: `room-${i + 1}`,
      status: RoomStatus.AVAILABLE,
    }));
    const { service, bookingRepo } = createGroupService({ rooms: manyRooms });

    await service.createGroup('t1', 'p1', 'user-1', groupDto);

    expect(bookingRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it("shu turdagi bo'sh xona qolmasa ConflictException tashlaydi (guruh baribir yaratilib bo'lgan bo'ladi, lekin so'rov transaksiya ichida bo'lgani uchun chaqiruvchi tomonda rollback bo'ladi)", async () => {
    const { service } = createGroupService({ rooms: [] });
    await expect(
      service.createGroup('t1', 'p1', 'user-1', groupDto),
    ).rejects.toThrow(ConflictException);
  });

  it("addRoomToGroup: mavjud guruhga yangi xona qo'shadi", async () => {
    const { service, bookingRepo, bookingGroupRepo } = createGroupService();
    bookingGroupRepo.findOne.mockResolvedValue({
      id: 'group-1',
      tenantId: 't1',
      propertyId: 'p1',
    });

    const booking = await service.addRoomToGroup('t1', 'p1', 'group-1', {
      roomTypeId: 'rt-1',
      guestId: 'guest-3',
      checkIn: '2026-11-01',
      checkOut: '2026-11-03',
    });

    expect(booking.groupId).toBe('group-1');
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
  });

  it('addRoomToGroup: guruh topilmasa NotFoundException tashlaydi', async () => {
    const { service, bookingGroupRepo } = createGroupService();
    bookingGroupRepo.findOne.mockResolvedValue(null);
    await expect(
      service.addRoomToGroup('t1', 'p1', 'yoq-guruh', {
        roomTypeId: 'rt-1',
        guestId: 'guest-1',
        checkIn: '2026-11-01',
        checkOut: '2026-11-03',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("listGroups: tenant/property bo'yicha filtrlab, bookings relation bilan qaytaradi", async () => {
    const { service, bookingGroupRepo } = createGroupService();
    bookingGroupRepo.find.mockResolvedValue([{ id: 'group-1' }]);
    const result = await service.listGroups('t1', 'p1');
    expect(result).toEqual([{ id: 'group-1' }]);
    expect(bookingGroupRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', propertyId: 'p1' } }),
    );
  });

  it('findGroupById: topilmasa NotFoundException tashlaydi', async () => {
    const { service, bookingGroupRepo } = createGroupService();
    bookingGroupRepo.findOne.mockResolvedValue(null);
    await expect(service.findGroupById('t1', 'p1', 'yoq')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// BookingsService.cancel — bekor qilish jarimasi (Cancellation Policy). "Bugun"
// deterministik bo'lishi uchun fake timer bilan qotiriladi (2026-08-25).
describe('BookingsService.cancel — bekor qilish jarimasi', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: false });
    jest.setSystemTime(new Date('2026-08-25T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createCancelService(
    booking: Record<string, unknown>,
    ratePlan: Record<string, unknown> | null,
  ) {
    const bookingRepo = {
      findOne: jest.fn().mockResolvedValue({ ...booking }),
      save: jest.fn((b: Record<string, unknown>) => Promise.resolve(b)),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...booking }),
      })),
    };
    const ratePlansService = {
      findById: jest.fn().mockResolvedValue(ratePlan),
    };
    const invoicingService = {
      createFeeInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    const agencyCommissionsService = { accrueForBooking: jest.fn() };
    // 2026-09-05 (audit №12): bron valyutasi mulkdan olinadi.
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', currency: 'UZS' }),
    };
    const service = new BookingsService(
      bookingRepo as never,
      {} as never,
      {} as never,
      {} as never,
      ratePlansService as never,
      {} as never,
      {} as never,
      {} as never,
      invoicingService as never,
      {} as never,
      propertyRepo as never,
      {} as never,
      agencyCommissionsService as never,
      {} as never,
    );
    return { service, bookingRepo, ratePlansService, invoicingService };
  }

  const baseBooking = {
    id: 'b1',
    tenantId: 't1',
    propertyId: 'p1',
    ratePlanId: 'rp-1',
    status: BookingStatus.CONFIRMED,
    totalAmount: '300.00',
    currency: 'UZS',
    guestId: 'guest-1',
  };

  it("bekor qilish muddati (deadline) o'tib ketgan bo'lsa, jarima hisoblab hisob-faktura yaratadi", async () => {
    const { service, bookingRepo, invoicingService } = createCancelService(
      { ...baseBooking, checkIn: '2026-08-26' }, // "bugun"dan 1 kun qolgan
      {
        id: 'rp-1',
        nightlyPrice: '100.00',
        cancellationDeadlineDays: 3,
        cancellationFeeType: 'percent_of_total',
        cancellationFeeValue: '50',
      },
    );

    const result = await service.cancel('t1', 'p1', 'b1');

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(result.cancellationFeeAmount).toBe('150.00');
    expect(bookingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancellationFeeAmount: '150.00',
      }),
    );
    expect(invoicingService.createFeeInvoice).toHaveBeenCalledWith(
      't1',
      'p1',
      expect.objectContaining({ id: 'b1', cancellationFeeAmount: '150.00' }),
      expect.any(String),
      '150.00',
      'cancellation_fee_revenue',
    );
  });

  it("bekor qilish hali muddat ichida bo'lsa, jarimasiz bekor qiladi", async () => {
    const { service, invoicingService } = createCancelService(
      { ...baseBooking, checkIn: '2026-09-05' }, // "bugun"dan 11 kun qolgan
      {
        id: 'rp-1',
        nightlyPrice: '100.00',
        cancellationDeadlineDays: 3,
        cancellationFeeType: 'percent_of_total',
        cancellationFeeValue: '50',
      },
    );

    const result = await service.cancel('t1', 'p1', 'b1');

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(result.cancellationFeeAmount).toBeUndefined();
    expect(invoicingService.createFeeInvoice).not.toHaveBeenCalled();
  });

  it("narx rejasi tanlanmagan (ratePlanId yo'q) bronni jarimasiz bekor qiladi", async () => {
    const { service, ratePlansService, invoicingService } = createCancelService(
      { ...baseBooking, ratePlanId: null, checkIn: '2026-08-26' },
      null,
    );

    const result = await service.cancel('t1', 'p1', 'b1');

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(ratePlansService.findById).not.toHaveBeenCalled();
    expect(invoicingService.createFeeInvoice).not.toHaveBeenCalled();
  });

  it('check-in qilingan bronni bekor qilishga urinsa ConflictException tashlaydi', async () => {
    const { service } = createCancelService(
      {
        ...baseBooking,
        status: BookingStatus.CHECKED_IN,
        checkIn: '2026-08-20',
      },
      null,
    );
    await expect(service.cancel('t1', 'p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('allaqachon bekor qilingan bronni qayta bekor qilishga urinsa ConflictException tashlaydi (ikkilanma-jarima himoyasi)', async () => {
    const { service, invoicingService } = createCancelService(
      {
        ...baseBooking,
        status: BookingStatus.CANCELLED,
        checkIn: '2026-08-20',
      },
      null,
    );
    await expect(service.cancel('t1', 'p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
    expect(invoicingService.createFeeInvoice).not.toHaveBeenCalled();
  });

  it("bron topilmasa (bloklab o'qishda) NotFoundException tashlaydi", async () => {
    const bookingRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };
    const agencyCommissionsService = { accrueForBooking: jest.fn() };
    // 2026-09-05 (audit №12): bron valyutasi mulkdan olinadi.
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', currency: 'UZS' }),
    };
    const service = new BookingsService(
      bookingRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      propertyRepo as never,
      {} as never,
      agencyCommissionsService as never,
      {} as never,
    );
    await expect(service.cancel('t1', 'p1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// 🔴 2026-09-05 (kod auditi): `cancel` NO_SHOW holatini tekshirmasdi.
// Night audit allaqachon kelmaganlik jarimasini hisoblab, hisob-faktura va
// bosh kitob yozuvini yaratgan bo'ladi; keyin bekor qilinsa bronning
// `cancellationFeeAmount` i boshqa summa bilan qayta yozilar, hisob-faktura
// esa eskisini saqlab qolardi.
describe('BookingsService.cancel — no-show bronni bekor qilib bolmaydi', () => {
  it('NO_SHOW holatidagi bron ConflictException beradi', async () => {
    const booking = {
      id: 'b1',
      tenantId: 't1',
      propertyId: 'p1',
      status: BookingStatus.NO_SHOW,
      cancellationFeeAmount: '1000000.00',
      ratePlanId: 'rp1',
    };
    const bookingRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(booking),
      })),
      save: jest.fn(),
    };
    const invoicingService = { createFeeInvoice: jest.fn() };
    const service = new BookingsService(
      bookingRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { findById: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      invoicingService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.cancel('t1', 'p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
    // Jarima hisob-fakturasi qayta yaratilmaydi va bron qayta yozilmaydi.
    expect(invoicingService.createFeeInvoice).not.toHaveBeenCalled();
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });
});
