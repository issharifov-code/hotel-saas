import { BadRequestException, ConflictException } from '@nestjs/common';
import { RatePlanRestrictionsService } from './rate-plan-restrictions.service';

// RatePlanRestrictionsService'ning eng muhim qoidalarini sinaydi: upsert
// (yaratish/yangilash), listForRatePlan (sana oralig'i bilan/siz), va
// assertBookingAllowed'ning har bir rad etish/o'tkazish shoxobchasi.
describe('RatePlanRestrictionsService', () => {
  function createService() {
    const restrictionRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      find: jest.fn((): Promise<unknown[]> => Promise.resolve([])),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const ratePlansService = {
      findById: jest.fn().mockResolvedValue({ id: 'rp-1' }),
    };
    const service = new RatePlanRestrictionsService(
      restrictionRepo as never,
      ratePlansService as never,
    );
    return { service, restrictionRepo, ratePlansService };
  }

  describe('upsert', () => {
    it("saqlashdan oldin narx rejasi shu tenant/property'ga tegishli ekanini tekshiradi", async () => {
      const { service, ratePlansService } = createService();
      await service.upsert('t1', 'p1', 'rp-1', '2026-09-01', {
        stopSell: true,
      });
      expect(ratePlansService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'rp-1',
      );
    });

    it("mavjud bo'lmagan sana uchun yangi yozuv yaratadi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValue(null);
      await service.upsert('t1', 'p1', 'rp-1', '2026-09-01', {
        stopSell: true,
      });
      // `create`'ga uzatilgan argument keyinchalik xizmat tomonidan mutatsiya
      // qilinadi (create mock'i xuddi shu obyektni qaytaradi) — shuning uchun
      // faqat o'zgarmas maydonlarni (ratePlanId/date) tekshiramiz.
      expect(restrictionRepo.create.mock.calls[0][0]).toMatchObject({
        ratePlanId: 'rp-1',
        date: '2026-09-01',
      });
      const saved = restrictionRepo.save.mock.calls[0][0] as {
        stopSell: boolean;
      };
      expect(saved.stopSell).toBe(true);
    });

    it("mavjud yozuvni faqat berilgan maydonlar bo'yicha yangilaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValue({
        id: 'rr-1',
        ratePlanId: 'rp-1',
        date: '2026-09-01',
        closedToArrival: false,
        closedToDeparture: false,
        stopSell: false,
        minLengthOfStay: null,
        maxLengthOfStay: null,
      });
      const result = await service.upsert('t1', 'p1', 'rp-1', '2026-09-01', {
        minLengthOfStay: 3,
      });
      expect(result).toMatchObject({
        id: 'rr-1',
        minLengthOfStay: 3,
        stopSell: false,
      });
    });
  });

  describe('listForRatePlan', () => {
    it("sana oralig'isiz — barcha cheklovlarni qaytaradi", async () => {
      const { service, restrictionRepo } = createService();
      await service.listForRatePlan('t1', 'p1', 'rp-1');
      expect(restrictionRepo.find).toHaveBeenCalledWith({
        where: { ratePlanId: 'rp-1' },
        order: { date: 'ASC' },
      });
    });

    it("sana oralig'i bilan — Between filtridan foydalanadi", async () => {
      const { service, restrictionRepo } = createService();
      await service.listForRatePlan(
        't1',
        'p1',
        'rp-1',
        '2026-09-01',
        '2026-09-30',
      );
      const arg = restrictionRepo.find.mock.calls[0][0] as {
        where: { ratePlanId: string; date: unknown };
      };
      expect(arg.where.ratePlanId).toBe('rp-1');
      expect(arg.where.date).toBeDefined();
    });
  });

  describe('assertBookingAllowed', () => {
    it("cheklov qo'yilmagan sanalar uchun hech narsa tashlamaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-03', 2),
      ).resolves.toBeUndefined();
    });

    it("Stop Sell qo'yilgan kelish sanasi uchun ConflictException tashlaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce({ stopSell: true });
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-03', 2),
      ).rejects.toThrow(ConflictException);
    });

    it("Closed to Arrival qo'yilgan kelish sanasi uchun ConflictException tashlaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        stopSell: false,
        closedToArrival: true,
      });
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-03', 2),
      ).rejects.toThrow(ConflictException);
    });

    it('Min Length of Stay talabidan kam turishda BadRequestException tashlaydi', async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        stopSell: false,
        closedToArrival: false,
        minLengthOfStay: 3,
      });
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-03', 2),
      ).rejects.toThrow(BadRequestException);
    });

    it("Max Length of Stay chegarasidan ko'p turishda BadRequestException tashlaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        stopSell: false,
        closedToArrival: false,
        maxLengthOfStay: 2,
      });
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-05', 4),
      ).rejects.toThrow(BadRequestException);
    });

    it("Closed to Departure qo'yilgan jo'nab ketish sanasi uchun ConflictException tashlaydi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce(null); // arrival date — no restriction
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        closedToDeparture: true,
      }); // departure date
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-03', 2),
      ).rejects.toThrow(ConflictException);
    });

    it("cheklovga zid bo'lmagan bron uchun muvaffaqiyatli o'tadi", async () => {
      const { service, restrictionRepo } = createService();
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        stopSell: false,
        closedToArrival: false,
        minLengthOfStay: 2,
        maxLengthOfStay: 10,
      });
      restrictionRepo.findOneBy.mockResolvedValueOnce({
        closedToDeparture: false,
      });
      await expect(
        service.assertBookingAllowed('rp-1', '2026-09-01', '2026-09-05', 4),
      ).resolves.toBeUndefined();
    });
  });
});
