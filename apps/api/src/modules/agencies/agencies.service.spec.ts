import { NotFoundException } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

// AgenciesService'ning eng muhim qoidalarini sinaydi: yaratishda default
// qiymatlar, topilmagan agentlik uchun NotFoundException, va getSummary'ning
// komissiya hisob-kitobi (bekor qilingan bronlar hisobga olinmasligi, foiz
// to'g'ri qo'llanilishi).
describe('AgenciesService', () => {
  function createService(
    bookings: unknown[] = [],
    agency: unknown = { id: 'a1', commissionPct: '10.00' },
  ) {
    const savedAgency = { id: 'a1' };
    const agencyRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(savedAgency),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(agency),
    };
    const bookingRepo = {
      find: jest.fn().mockResolvedValue(bookings),
    };
    const service = new AgenciesService(
      agencyRepo as never,
      bookingRepo as never,
    );
    return { service, agencyRepo, bookingRepo };
  }

  it("yaratishda commissionPct berilmasa 10 (default) qo'yiladi, isActive=true", async () => {
    const { service, agencyRepo } = createService();
    await service.create('t1', 'p1', { name: 'ACME Travel' });
    const createdArg = agencyRepo.create.mock.calls[0][0];
    expect(createdArg.commissionPct).toBe('10');
    expect(createdArg.isActive).toBe(true);
  });

  it('yaratishda berilgan commissionPct saqlanadi', async () => {
    const { service, agencyRepo } = createService();
    await service.create('t1', 'p1', {
      name: 'ACME Travel',
      commissionPct: '15.50',
    });
    expect(agencyRepo.create.mock.calls[0][0].commissionPct).toBe('15.50');
  });

  it('topilmagan agentlik uchun NotFoundException tashlaydi', async () => {
    const { service, agencyRepo } = createService();
    agencyRepo.findOneBy.mockResolvedValue(null);
    await expect(service.findById('t1', 'p1', 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update — faqat berilgan maydonlarni o'zgartiradi", async () => {
    const { service, agencyRepo } = createService();
    agencyRepo.findOneBy.mockResolvedValue({
      id: 'a1',
      name: 'ACME Travel',
      commissionPct: '10.00',
      isActive: true,
    });
    agencyRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

    const result = await service.update('t1', 'p1', 'a1', { isActive: false });
    expect(result).toMatchObject({ isActive: false, name: 'ACME Travel' });
  });

  it("getSummary — bekor qilingan bronlarni hisobga olmaydi, komissiyani to'g'ri hisoblaydi", async () => {
    const bookings = [
      {
        id: 'b1',
        totalAmount: '1000000.00',
        status: BookingStatus.CHECKED_OUT,
      },
      { id: 'b2', totalAmount: '500000.00', status: BookingStatus.CONFIRMED },
    ];
    const { service, bookingRepo } = createService(bookings, {
      id: 'a1',
      commissionPct: '10.00',
    });
    // findById (real query) ham chaqiriladi — findOneBy orqali agency qaytarilishi kerak
    const summary = await service.getSummary('t1', 'p1', 'a1');

    const whereMatcher: unknown = expect.objectContaining({
      tenantId: 't1',
      propertyId: 'p1',
      agencyId: 'a1',
    });
    expect(bookingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: whereMatcher }),
    );
    expect(summary.bookingCount).toBe(2);
    expect(summary.totalRevenue).toBe('1500000.00');
    expect(summary.commissionOwed).toBe('150000.00'); // 1,500,000 * 10%
  });

  it("getSummary — bronlar bo'lmasa 0 qaytaradi", async () => {
    const { service } = createService([], { id: 'a1', commissionPct: '10.00' });
    const summary = await service.getSummary('t1', 'p1', 'a1');
    expect(summary.bookingCount).toBe(0);
    expect(summary.totalRevenue).toBe('0.00');
    expect(summary.commissionOwed).toBe('0.00');
  });

  it("getSummary — mavjud bo'lmagan agentlik uchun NotFoundException tashlaydi", async () => {
    const { service, agencyRepo } = createService();
    agencyRepo.findOneBy.mockResolvedValue(null);
    await expect(service.getSummary('t1', 'p1', 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
