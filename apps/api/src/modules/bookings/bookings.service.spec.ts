import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingSource, BookingStatus } from './entities/booking.entity';

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

    await service.create('t1', 'p1', { ...dto, marketSegment: 'corporate' as never });
    expect(bookingRepo.create.mock.calls[1][0].marketSegment).toBe('corporate');
  });
});
