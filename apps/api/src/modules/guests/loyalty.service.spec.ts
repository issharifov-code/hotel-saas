import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyTier } from './entities/guest.entity';
import { LoyaltyTransactionType } from './entities/loyalty-transaction.entity';

// Bu testlar LoyaltyService'ning ikkita eng muhim invariantini tekshiradi:
// (1) daraja bo'sag'alari to'g'ri hisoblanishi, (2) ball qoldig'i hech qachon
// manfiy bo'lmasligi va har bir o'zgarish audit tranzaksiyasi bilan birga kelishi.
// Haqiqiy DB o'rniga — guestRepo/txRepo uchun minimal, xotirada ishlaydigan mock kifoya.
describe('LoyaltyService', () => {
  function createService(
    initialGuest: Partial<{
      loyaltyPoints: number;
      lifetimePoints: number;
      loyaltyTier: LoyaltyTier;
    }>,
  ) {
    const guest = {
      id: 'g1',
      tenantId: 't1',
      loyaltyPoints: initialGuest.loyaltyPoints ?? 0,
      lifetimePoints: initialGuest.lifetimePoints ?? 0,
      loyaltyTier: initialGuest.loyaltyTier ?? LoyaltyTier.BRONZE,
    };

    // 🔴 2026-09-05: xizmat endi mehmon qatorini QULF bilan o'qiydi
    // (`setLock('pessimistic_write')`) — integratsion testda topilgan
    // "yo'qolgan yangilanish" nuqsoni uchun. Shuning uchun mock ham
    // `findOneBy` emas, query builder shaklida.
    //
    // `locks` massivi qulf HAQIQATAN so'ralganini yozib boradi: quyida
    // shu tekshiriladi. Bu muhim — qulfsiz kod unit testda BEXATAR
    // ko'rinardi va nuqson faqat parallel so'rovlarda ochilardi.
    const locks: string[] = [];
    const where: Record<string, unknown> = {};
    const qb = {
      setLock: (mode: string) => {
        locks.push(mode);
        return qb;
      },
      where: (_sql: string, params: Record<string, unknown>) => {
        Object.assign(where, params);
        return qb;
      },
      andWhere: (_sql: string, params: Record<string, unknown>) => {
        Object.assign(where, params);
        return qb;
      },
      getOne: () =>
        where.guestId === guest.id && where.tenantId === guest.tenantId
          ? Promise.resolve({ ...guest })
          : Promise.resolve(null),
    };

    const guestRepo = {
      createQueryBuilder: jest.fn(() => qb),
      save: jest.fn().mockImplementation((g: typeof guest) => {
        Object.assign(guest, g);
        return Promise.resolve({ ...guest });
      }),
    };

    const savedTransactions: unknown[] = [];
    const txRepo = {
      create: (data: unknown) => data,
      save: jest.fn().mockImplementation((tx: unknown) => {
        savedTransactions.push(tx);
        return Promise.resolve(tx);
      }),
      find: jest.fn(),
    };

    const service = new LoyaltyService(guestRepo as never, txRepo as never);
    return { service, guest, guestRepo, txRepo, savedTransactions, locks };
  }

  describe('calculateTier', () => {
    it("bo'sag'alarga mos darajani qaytaradi", () => {
      const { service } = createService({});
      expect(service.calculateTier(0)).toBe(LoyaltyTier.BRONZE);
      expect(service.calculateTier(999)).toBe(LoyaltyTier.BRONZE);
      expect(service.calculateTier(1000)).toBe(LoyaltyTier.SILVER);
      expect(service.calculateTier(4999)).toBe(LoyaltyTier.SILVER);
      expect(service.calculateTier(5000)).toBe(LoyaltyTier.GOLD);
      expect(service.calculateTier(14999)).toBe(LoyaltyTier.GOLD);
      expect(service.calculateTier(15000)).toBe(LoyaltyTier.PLATINUM);
      expect(service.calculateTier(100000)).toBe(LoyaltyTier.PLATINUM);
    });
  });

  describe('pointsForPayment', () => {
    it("to'lov summasidan ballni pastga yaxlitlab hisoblaydi (1 ball = 10 birlik)", () => {
      const { service } = createService({});
      expect(service.pointsForPayment('100.00')).toBe(10);
      expect(service.pointsForPayment('105.00')).toBe(10);
      expect(service.pointsForPayment('9.99')).toBe(0);
      expect(service.pointsForPayment(1000)).toBe(100);
    });
  });

  describe('awardPointsForPayment', () => {
    it("guestId bo'lmasa hech narsa qilmaydi", async () => {
      const { service, guestRepo } = createService({});
      await service.awardPointsForPayment('t1', null, '500.00', 'inv1');
      expect(guestRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("to'lov ballarni qo'shadi, lifetimePoints va tier'ni yangilaydi, tranzaksiya yozadi", async () => {
      const { service, guest, savedTransactions } = createService({
        loyaltyPoints: 50,
        lifetimePoints: 950,
      });
      await service.awardPointsForPayment('t1', 'g1', '600.00', 'inv1');
      // 600 * 0.1 = 60 ball
      expect(guest.loyaltyPoints).toBe(110);
      expect(guest.lifetimePoints).toBe(1010);
      expect(guest.loyaltyTier).toBe(LoyaltyTier.SILVER); // 1000 bo'sag'asidan o'tdi
      expect(savedTransactions).toHaveLength(1);
      expect(savedTransactions[0]).toMatchObject({
        guestId: 'g1',
        type: LoyaltyTransactionType.EARN,
        points: 60,
        relatedInvoiceId: 'inv1',
      });
    });

    it("0 ball hosil bo'lsa (juda kichik to'lov) tranzaksiya yozmaydi", async () => {
      const { service, guest, savedTransactions } = createService({});
      await service.awardPointsForPayment('t1', 'g1', '5.00', 'inv1');
      expect(guest.loyaltyPoints).toBe(0);
      expect(savedTransactions).toHaveLength(0);
    });
  });

  // 🔴 QO'RIQCHI (2026-09-05). Qulfsiz bu xizmat unit testda BEXATAR
  // ko'rinardi — nuqson faqat parallel so'rovlarda ochilardi va u
  // integratsion testda topildi: qoldiq 100 bo'lganda bir vaqtda
  // beshta "−80" so'rovidan TO'RTTASI o'tib ketdi.
  //
  // Shuning uchun bu yerda MANTIQ emas, MEXANIZM tekshiriladi: har bir
  // ball o'zgarishida qator qulf bilan o'qilishi SHART.
  describe('qator qulfi', () => {
    it("ball o'zgarishida pessimistic_write qulfi so'raladi", async () => {
      const { service, locks } = createService({ loyaltyPoints: 100 });
      await service.adjustPoints('t1', 'g1', -10, 'sinov', 'u1');
      expect(locks).toEqual(['pessimistic_write']);
    });

    it("to'lovdan ball hisoblashda ham qulf so'raladi", async () => {
      const { service, locks } = createService({});
      await service.awardPointsForPayment('t1', 'g1', '100000', 'inv1', 'u1');
      expect(locks).toEqual(['pessimistic_write']);
    });
  });

  describe('adjustPoints', () => {
    it('0 ball bilan chaqirilsa xato tashlaydi', async () => {
      const { service } = createService({});
      await expect(
        service.adjustPoints('t1', 'g1', 0, 'sabab', 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it("natijada qoldiq manfiy bo'lsa xato tashlaydi va hech narsa saqlanmaydi", async () => {
      const { service, guest, guestRepo, savedTransactions } = createService({
        loyaltyPoints: 30,
      });
      await expect(
        service.adjustPoints('t1', 'g1', -50, 'xato tuzatish', 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(guest.loyaltyPoints).toBe(30); // o'zgarmadi
      expect(guestRepo.save).not.toHaveBeenCalled();
      expect(savedTransactions).toHaveLength(0);
    });

    it("musbat tuzatish ball qo'shadi va lifetime/tier'ni yangilaydi", async () => {
      const { service, guest } = createService({
        loyaltyPoints: 10,
        lifetimePoints: 10,
      });
      const result = await service.adjustPoints('t1', 'g1', 20, 'bonus', 'u1');
      expect(result.loyaltyPoints).toBe(30);
      expect(guest.lifetimePoints).toBe(30);
    });

    it("manfiy tuzatish (ruxsat etilgan doirada) ball ayiradi, lifetime'ga tegmaydi", async () => {
      const { service, guest } = createService({
        loyaltyPoints: 100,
        lifetimePoints: 1200,
        loyaltyTier: LoyaltyTier.SILVER,
      });
      const result = await service.adjustPoints(
        't1',
        'g1',
        -40,
        'xato tuzatish',
        'u1',
      );
      expect(result.loyaltyPoints).toBe(60);
      expect(guest.lifetimePoints).toBe(1200); // umr bo'yi ball kamaymaydi
      expect(guest.loyaltyTier).toBe(LoyaltyTier.SILVER); // daraja pasaymaydi
    });

    it("mavjud bo'lmagan mehmon uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({});
      await expect(
        service.adjustPoints('t1', 'unknown', 10, 'sabab', 'u1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
