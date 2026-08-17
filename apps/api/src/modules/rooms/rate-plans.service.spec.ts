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
    const service = new RatePlansService(ratePlanRepo as never, roomTypesService as never);
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

  it('update — faqat berilgan maydonlarni o\'zgartiradi', async () => {
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

    const result = await service.update('t1', 'p1', 'rp-1', { isActive: false });
    expect(result).toMatchObject({ isActive: false, name: 'Rack Rate' });
  });
});
