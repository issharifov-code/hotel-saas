import { BadRequestException, ConflictException } from '@nestjs/common';
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
    const guestsService = {
      findById: jest.fn().mockResolvedValue({ id: 'guest-1' }),
    };
    const housekeepingService = {};
    const invoicingService = {};

    const service = new BookingsService(
      bookingRepo as never,
      roomRepo as never,
      roomTypeRepo as never,
      roomsService as never,
      ratePlansService as never,
      guestsService as never,
      housekeepingService as never,
      invoicingService as never,
    );
    return { service, bookingRepo, bookingQueryBuilder, ratePlansService };
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

    let currentRoomId: string | undefined;
    // `where()` o'zining natijasiga (query builder'ning o'ziga) qaytishi
    // kerak — `mockReturnThis()` ishlatiladi (avvalgi describe blokidagi kabi),
    // roomId esa alohida `mockImplementation` orqali ushlab qolinadi.
    const bookingQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(() =>
        Promise.resolve(
          currentRoomId ? (conflictByRoomId[currentRoomId] ?? null) : null,
        ),
      ),
    };
    bookingQueryBuilder.where.mockImplementation(
      (_sql: unknown, args: unknown) => {
        currentRoomId = (args as { roomId: string }).roomId;
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
    const guestsService = {};
    const housekeepingService = {};
    const invoicingService = {};

    const service = new BookingsService(
      bookingRepo as never,
      roomRepo as never,
      roomTypeRepo as never,
      roomsService as never,
      ratePlansService as never,
      guestsService as never,
      housekeepingService as never,
      invoicingService as never,
    );
    return { service, bookingRepo, roomRepo, ratePlansService };
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
});
