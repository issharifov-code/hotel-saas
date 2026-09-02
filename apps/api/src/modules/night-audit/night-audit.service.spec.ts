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
      ratePlan?: Record<string, unknown> | null;
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
    const ratePlansService = {
      findByIds: jest
        .fn()
        .mockResolvedValue(opts.ratePlan ? [opts.ratePlan] : []),
    };
    const invoicingService = {
      createFeeInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const service = new NightAuditService(
      runRepo as never,
      propertyRepo as never,
      bookingRepo as never,
      roomRepo as never,
      ratePlansService as never,
      invoicingService as never,
    );
    return {
      service,
      runRepo,
      propertyRepo,
      bookingRepo,
      roomRepo,
      property,
      ratePlansService,
      invoicingService,
    };
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

  it("narx rejasida no-show jarimasi sozlangan bo'lsa, jarima hisob-fakturasi yaratadi", async () => {
    const { service, bookingRepo, invoicingService } = createService({
      noShowCandidates: [
        {
          id: 'b1',
          ratePlanId: 'rp-1',
          status: BookingStatus.CONFIRMED,
          checkIn: '2026-08-24',
          totalAmount: '300.00',
          currency: 'UZS',
          guestId: 'guest-1',
        },
      ],
      ratePlan: {
        id: 'rp-1',
        nightlyPrice: '100.00',
        noShowFeeType: 'first_night',
        noShowFeeValue: '100.00',
      },
    });

    await service.run('t1', 'prop-1', 'user-1');

    expect(bookingRepo.update).toHaveBeenCalledWith(
      { id: 'b1' },
      { status: BookingStatus.NO_SHOW, cancellationFeeAmount: '100.00' },
    );
    expect(invoicingService.createFeeInvoice).toHaveBeenCalledWith(
      't1',
      'prop-1',
      expect.objectContaining({ id: 'b1', cancellationFeeAmount: '100.00' }),
      expect.any(String),
      '100.00',
      'cancellation_fee_revenue',
    );
  });

  it("narx rejasida no-show jarimasi sozlanmagan bo'lsa, jarimasiz no_show belgilaydi", async () => {
    const { service, bookingRepo, invoicingService } = createService({
      noShowCandidates: [
        {
          id: 'b1',
          ratePlanId: 'rp-1',
          status: BookingStatus.CONFIRMED,
          checkIn: '2026-08-24',
          totalAmount: '300.00',
          currency: 'UZS',
          guestId: 'guest-1',
        },
      ],
      ratePlan: {
        id: 'rp-1',
        nightlyPrice: '100.00',
        noShowFeeType: null,
        noShowFeeValue: null,
      },
    });

    await service.run('t1', 'prop-1', 'user-1');

    expect(bookingRepo.update).toHaveBeenCalledWith(
      { id: 'b1' },
      { status: BookingStatus.NO_SHOW },
    );
    expect(invoicingService.createFeeInvoice).not.toHaveBeenCalled();
  });

  it("narx rejalarini nechta no-show nomzod bo'lishidan qat'iy nazar BITTA (batched) so'rovda yuklaydi", async () => {
    // Avval har bir nomzod bron uchun alohida `ratePlansService.findById`
    // chaqirilardi (N ta bron = N ta ketma-ket so'rov) — endi bitta
    // `findByIds` chaqiruviga yig'iladi, natijalar xotirada taqsimlanadi.
    const candidates = Array.from({ length: 12 }, (_, i) => ({
      id: `b${i}`,
      ratePlanId: i % 3 === 0 ? 'rp-1' : 'rp-2',
      status: BookingStatus.CONFIRMED,
      checkIn: '2026-08-24',
      totalAmount: '300.00',
      currency: 'UZS',
      guestId: `guest-${i}`,
    }));
    const { service, bookingRepo, ratePlansService } = createService({
      noShowCandidates: candidates,
    });
    ratePlansService.findByIds = jest.fn().mockResolvedValue([
      {
        id: 'rp-1',
        nightlyPrice: '100.00',
        noShowFeeType: null,
        noShowFeeValue: null,
      },
      {
        id: 'rp-2',
        nightlyPrice: '100.00',
        noShowFeeType: null,
        noShowFeeValue: null,
      },
    ]);

    await service.run('t1', 'prop-1', 'user-1');

    expect(ratePlansService.findByIds).toHaveBeenCalledTimes(1);
    expect(ratePlansService.findByIds).toHaveBeenCalledWith(
      't1',
      'prop-1',
      expect.arrayContaining(['rp-1', 'rp-2']),
    );
    // Barcha 12 ta nomzod — parallel (cheklangan concurrency) ishlanishiga
    // qaramay — muvaffaqiyatli yangilanishi kerak.
    expect(bookingRepo.update).toHaveBeenCalledTimes(12);
    for (const c of candidates) {
      expect(bookingRepo.update).toHaveBeenCalledWith(
        { id: c.id },
        { status: BookingStatus.NO_SHOW },
      );
    }
  });

  it("dangling ratePlanId (narx rejasi topilmasa) butun audit jarayonini to'xtatmaydi — jarimasiz no_show belgilanadi", async () => {
    const { service, bookingRepo, ratePlansService } = createService({
      noShowCandidates: [
        {
          id: 'b1',
          ratePlanId: 'rp-yoq',
          status: BookingStatus.CONFIRMED,
          checkIn: '2026-08-24',
          totalAmount: '300.00',
          currency: 'UZS',
          guestId: 'guest-1',
        },
      ],
    });
    ratePlansService.findByIds = jest.fn().mockResolvedValue([]); // topilmadi

    await expect(service.run('t1', 'prop-1', 'user-1')).resolves.toBeDefined();
    expect(bookingRepo.update).toHaveBeenCalledWith(
      { id: 'b1' },
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
