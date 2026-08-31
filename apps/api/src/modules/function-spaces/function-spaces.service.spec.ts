import { ConflictException, NotFoundException } from '@nestjs/common';
import { FunctionSpacesService } from './function-spaces.service';
import { FunctionSpaceBookingStatus } from './entities/function-space-booking.entity';

// FunctionSpacesService'ning eng muhim qoidalarini sinaydi: zal yaratishda
// default qiymatlar, topilmagan zal/bron uchun NotFoundException, va eng
// muhimi — vaqt to'qnashuvini tekshirish (bookings.service.spec.ts'dagi
// xona to'qnashuvi testlariga o'xshab, faqat timestamp ustunlar bilan).
describe('FunctionSpacesService', () => {
  function createService(
    existingBookings: unknown[] = [],
    space: unknown = { id: 's1', isActive: true },
  ) {
    const spaceRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 's1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(space),
    };
    // getOne — to'qnashuvni tekshirishda ishlatiladi; standart holatda bo'sh (to'qnashuv yo'q).
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const bookingRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'b1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue(existingBookings),
      findOne: jest.fn().mockResolvedValue(existingBookings[0] ?? null),
      createQueryBuilder: jest.fn(() => qb),
    };
    const service = new FunctionSpacesService(
      spaceRepo as never,
      bookingRepo as never,
    );
    return { service, spaceRepo, bookingRepo, qb };
  }

  const baseDto = {
    functionSpaceId: 's1',
    eventName: 'Konferensiya',
    organizerName: 'ACME LLC',
    startTime: '2026-09-01T10:00:00.000Z',
    endTime: '2026-09-01T14:00:00.000Z',
  };

  it("zal yaratishda dailyRate berilmasa '0' (default) qo'yiladi, isActive=true", async () => {
    const { service, spaceRepo } = createService();
    await service.createSpace('t1', 'p1', { name: 'Katta zal', capacity: 100 });
    const createdArg = spaceRepo.create.mock.calls[0][0];
    expect(createdArg.dailyRate).toBe('0');
    expect(createdArg.isActive).toBe(true);
  });

  it('topilmagan zal uchun NotFoundException tashlaydi', async () => {
    const { service, spaceRepo } = createService();
    spaceRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.findSpaceById('t1', 'p1', 'no-such-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("tugash vaqti boshlanishdan oldin bo'lsa ConflictException tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.createBooking(
        't1',
        'p1',
        {
          ...baseDto,
          startTime: '2026-09-01T14:00:00.000Z',
          endTime: '2026-09-01T10:00:00.000Z',
        },
        'u1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("to'qnashuv bo'lmasa bron muvaffaqiyatli yaratiladi (status default CONFIRMED)", async () => {
    const { service, bookingRepo } = createService();
    await service.createBooking('t1', 'p1', baseDto, 'u1');
    const createdArg = bookingRepo.create.mock.calls[0][0];
    expect(createdArg.status).toBe(FunctionSpaceBookingStatus.CONFIRMED);
    expect(createdArg.functionSpaceId).toBe('s1');
    expect(createdArg.createdByUserId).toBe('u1');
  });

  it("bekor qilingan (CANCELLED) status bilan yaratishda to'qnashuv tekshirilmaydi", async () => {
    const { service, bookingRepo, qb } = createService();
    await service.createBooking(
      't1',
      'p1',
      {
        ...baseDto,
        status: FunctionSpaceBookingStatus.CANCELLED,
      },
      'u1',
    );
    expect(qb.getOne).not.toHaveBeenCalled();
    expect(bookingRepo.create.mock.calls[0][0].status).toBe(
      FunctionSpaceBookingStatus.CANCELLED,
    );
  });

  it("vaqt to'qnashsa ConflictException tashlaydi", async () => {
    const { service, qb } = createService();
    qb.getOne.mockResolvedValue({ id: 'existing-booking' });
    await expect(
      service.createBooking('t1', 'p1', baseDto, 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  it("mavjud bo'lmagan zal uchun bron yaratishda NotFoundException tashlaydi", async () => {
    const { service, spaceRepo } = createService();
    spaceRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.createBooking('t1', 'p1', baseDto, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('topilmagan bron uchun NotFoundException tashlaydi', async () => {
    const { service, bookingRepo } = createService();
    bookingRepo.findOne.mockResolvedValue(null);
    await expect(
      service.findBookingById('t1', 'p1', 'no-such-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("update — vaqt o'zgarganda to'qnashuvni o'zini o'zi bilan chalkashtirmaydi (excludeBookingId)", async () => {
    const existing = {
      id: 'b1',
      functionSpaceId: 's1',
      startTime: new Date('2026-09-01T10:00:00.000Z'),
      endTime: new Date('2026-09-01T14:00:00.000Z'),
      status: FunctionSpaceBookingStatus.CONFIRMED,
    };
    const { service, bookingRepo, qb } = createService([existing]);
    await service.updateBooking('t1', 'p1', 'b1', {
      startTime: '2026-09-01T11:00:00.000Z',
    });
    // createQueryBuilder chaqirilgan bo'lishi kerak (vaqt o'zgargani uchun qayta tekshiriladi)
    expect(bookingRepo.createQueryBuilder).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('b.id != :excludeBookingId', {
      excludeBookingId: 'b1',
    });
  });

  it("update — statusni CANCELLED qilishda to'qnashuv tekshirilmaydi", async () => {
    const existing = {
      id: 'b1',
      functionSpaceId: 's1',
      startTime: new Date('2026-09-01T10:00:00.000Z'),
      endTime: new Date('2026-09-01T14:00:00.000Z'),
      status: FunctionSpaceBookingStatus.CONFIRMED,
    };
    const { service, bookingRepo } = createService([existing]);
    await service.updateBooking('t1', 'p1', 'b1', {
      status: FunctionSpaceBookingStatus.CANCELLED,
    });
    expect(bookingRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
