import { NotFoundException } from '@nestjs/common';
import { RatePlansService } from './rate-plans.service';

// RatePlansService'ning eng muhim qoidalarini sinaydi: yaratishda roomType
// tenant/property'ga tegishli ekanligi tekshirilishi, va topilmagan reja uchun
// NotFoundException.
describe('RatePlansService', () => {
  function createService() {
    const savedRatePlan = { id: 'rp-1' };
    const ratePlanRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(savedRatePlan),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
    };
    const roomTypesService = {
      findById: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    };
    const service = new RatePlansService(
      ratePlanRepo as never,
      roomTypesService as never,
    );
    return { service, ratePlanRepo, roomTypesService };
  }

  it("yaratishdan oldin roomType shu tenant/property'ga tegishli ekanini tekshiradi", async () => {
    const { service, roomTypesService } = createService();
    await service.create('t1', 'p1', {
      roomTypeId: 'rt-1',
      name: 'Rack Rate',
      nightlyPrice: '800000',
    });
    expect(roomTypesService.findById).toHaveBeenCalledWith('t1', 'p1', 'rt-1');
  });

  it('yaratilgan reja isActive=true bilan boshlanadi', async () => {
    const { service, ratePlanRepo } = createService();
    await service.create('t1', 'p1', {
      roomTypeId: 'rt-1',
      name: 'Rack Rate',
      nightlyPrice: '800000',
    });
    const createdArg = ratePlanRepo.create.mock.calls[0][0];
    expect(createdArg.isActive).toBe(true);
    expect(createdArg.isRefundable).toBe(true);
  });

  it('topilmagan reja uchun NotFoundException tashlaydi', async () => {
    const { service, ratePlanRepo } = createService();
    ratePlanRepo.findOneBy.mockResolvedValue(null);
    await expect(service.findById('t1', 'p1', 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update — faqat berilgan maydonlarni o'zgartiradi", async () => {
    const { service, ratePlanRepo } = createService();
    ratePlanRepo.findOneBy.mockResolvedValue({
      id: 'rp-1',
      name: 'Rack Rate',
      nightlyPrice: '800000',
      isRefundable: true,
      isActive: true,
      description: null,
    });
    ratePlanRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

    const result = await service.update('t1', 'p1', 'rp-1', {
      isActive: false,
    });
    expect(result).toMatchObject({ isActive: false, name: 'Rack Rate' });
  });

  it("yaratilgan reja bekor qilish siyosati berilmasa hammasi null bo'ladi (jarimasiz)", async () => {
    const { service, ratePlanRepo } = createService();
    await service.create('t1', 'p1', {
      roomTypeId: 'rt-1',
      name: 'Rack Rate',
      nightlyPrice: '800000',
    });
    const createdArg = ratePlanRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(createdArg.cancellationDeadlineDays).toBeNull();
    expect(createdArg.cancellationFeeType).toBeNull();
    expect(createdArg.noShowFeeType).toBeNull();
  });

  it('yaratishda bekor qilish siyosati berilsa saqlanadi', async () => {
    const { service, ratePlanRepo } = createService();
    await service.create('t1', 'p1', {
      roomTypeId: 'rt-1',
      name: 'Non-refundable',
      nightlyPrice: '800000',
      cancellationDeadlineDays: 3,
      cancellationFeeType: 'first_night' as never,
      cancellationFeeValue: '800000',
      noShowFeeType: 'flat' as never,
      noShowFeeValue: '100000',
    });
    const createdArg = ratePlanRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(createdArg.cancellationDeadlineDays).toBe(3);
    expect(createdArg.cancellationFeeType).toBe('first_night');
    expect(createdArg.noShowFeeValue).toBe('100000');
  });

  it('update — bekor qilish siyosati maydonlarini yangilaydi', async () => {
    const { service, ratePlanRepo } = createService();
    ratePlanRepo.findOneBy.mockResolvedValue({
      id: 'rp-1',
      name: 'Rack Rate',
      nightlyPrice: '800000',
      isRefundable: true,
      isActive: true,
      description: null,
      cancellationDeadlineDays: null,
      cancellationFeeType: null,
      cancellationFeeValue: null,
      noShowFeeType: null,
      noShowFeeValue: null,
    });
    ratePlanRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

    const result = await service.update('t1', 'p1', 'rp-1', {
      cancellationDeadlineDays: 5,
      cancellationFeeType: 'percent_of_total' as never,
      cancellationFeeValue: '30',
    });
    expect(result).toMatchObject({
      cancellationDeadlineDays: 5,
      cancellationFeeType: 'percent_of_total',
      cancellationFeeValue: '30',
    });
  });
});
