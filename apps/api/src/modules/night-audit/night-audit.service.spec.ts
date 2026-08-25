import { ConflictException, NotFoundException } from '@nestjs/common';
import { NightAuditService } from './night-audit.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

describe('NightAuditService', () => {
  function createService(
    opts: {
      property?: Record<string, unknown> | null;
      existingRun?: Record<string, unknown> | null;
      noShowCandidates?: Record<string, unknown>[];
      stayingBookings?: Record<string, unknown>[];
      totalRooms?: number;
    } = {},
  ) {
    const property = {
      id: 'prop-1',
      tenantId: 't1',
      businessDate: '2026-08-25',
      ...opts.property,
    };

    const runRepo = {
      findOne: jest.fn().mockResolvedValue(opts.existingRun ?? null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'run-1', ...data }),
      ),
    };
    const propertyRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue(opts.property === null ? null : property),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const bookingRepo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest
        .fn()
        .mockResolvedValueOnce(opts.noShowCandidates ?? [])
        .mockResolvedValueOnce(opts.stayingBookings ?? []),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const roomRepo = {
      count: jest.fn().mockResolvedValue(opts.totalRooms ?? 10),
    };

    const service = new NightAuditService(
      runRepo as never,
      propertyRepo as never,
      bookingRepo as never,
      roomRepo as never,
    );
    return { service, runRepo, propertyRepo, bookingRepo, roomRepo, property };
  }

  it("mavjud bo'lmagan mulk uchun NotFoundException tashlaydi", async () => {
    const { service } = createService({ property: null });
    await expect(service.run('t1', 'prop-x', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("shu sana uchun audit allaqachon bajarilgan bo'lsa ConflictException tashlaydi", async () => {
    const { service } = createService({
      existingRun: { id: 'run-0', auditDate: '2026-08-25' },
    });
    await expect(service.run('t1', 'prop-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it("kelish sanasi o'tgan pending/confirmed bronlarni no_show deb belgilaydi", async () => {
    const { service, bookingRepo } = createService({
      noShowCandidates: [
        { id: 'b1', status: BookingStatus.PENDING, checkIn: '2026-08-24' },
        { id: 'b2', status: BookingStatus.CONFIRMED, checkIn: '2026-08-25' },
      ],
    });

    await service.run('t1', 'prop-1', 'user-1');

    expect(bookingRepo.update).toHaveBeenCalledWith(
      { id: 'b1' },
      { status: BookingStatus.NO_SHOW },
    );
    expect(bookingRepo.update).toHaveBeenCalledWith(
      { id: 'b2' },
      { status: BookingStatus.NO_SHOW },
    );
  });

  it("bandlik/ADR/RevPAR/xona daromadini to'g'ri hisoblaydi va NightAuditRun saqlaydi", async () => {
    const { service, runRepo } = createService({
      totalRooms: 10,
      stayingBookings: [
        {
          checkIn: '2026-08-24',
          checkOut: '2026-08-27',
          totalAmount: '300.00',
        }, // 3 tun, 100/tun
      ],
    });

    const run = await service.run('t1', 'prop-1', 'user-1');

    expect(runRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        totalRooms: 10,
        occupiedRooms: 1,
        occupancyRatePct: '10.00',
        adr: '100.00',
        revPar: '10.00',
        roomRevenue: '100.00',
        auditDate: '2026-08-25',
        noShowsProcessed: 0,
        runByUserId: 'user-1',
      }),
    );
    expect(run).toBeDefined();
  });

  it("muvaffaqiyatli audit'dan so'ng property.businessDate'ni bir kunga suradi", async () => {
    const { service, propertyRepo } = createService();

    await service.run('t1', 'prop-1', 'user-1');

    expect(propertyRepo.update).toHaveBeenCalledWith(
      { id: 'prop-1' },
      { businessDate: '2026-08-26' },
    );
  });

  it('getStatus joriy biznes sanasi va kutilayotgan no-show sonini qaytaradi', async () => {
    const { service, bookingRepo, runRepo } = createService();
    bookingRepo.count.mockResolvedValueOnce(3);
    runRepo.findOne.mockResolvedValueOnce({
      auditDate: '2026-08-24',
      createdAt: new Date('2026-08-25T02:00:00Z'),
    });

    const status = await service.getStatus('t1', 'prop-1');

    expect(status.businessDate).toBe('2026-08-25');
    expect(status.pendingNoShows).toBe(3);
    expect(status.lastAuditDate).toBe('2026-08-24');
  });
});
