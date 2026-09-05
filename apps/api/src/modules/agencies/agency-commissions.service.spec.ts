import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgencyCommissionsService } from './agency-commissions.service';
import { AgencyCommissionStatus } from './entities/agency-commission.entity';
import { AgencyPaymentMethod } from './entities/agency-commission-payment.entity';
import { BookingStatus } from '../bookings/entities/booking.entity';

// Komissiya endi provodka sifatida yoziladi — shuning uchun bu yerdagi
// sinovlar ikkita narsani himoya qiladi: PUL summasining to'g'riligi va
// yozuvning bir martaligi (idempotentlik).
describe('AgencyCommissionsService', () => {
  function createService(opts: {
    agency?: unknown;
    existingCommission?: unknown;
    commissions?: unknown[];
    bookings?: unknown[];
  } = {}) {
    const saved: Record<string, unknown>[] = [];
    const commissionRepo = {
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn((x: Record<string, unknown>) => {
        const row = { id: `c${saved.length + 1}`, ...x };
        saved.push(row);
        return Promise.resolve(row);
      }),
      findOne: jest.fn().mockResolvedValue(opts.existingCommission ?? null),
      find: jest.fn().mockResolvedValue(opts.commissions ?? []),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const paymentRepo = {
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn((x: Record<string, unknown>) =>
        Promise.resolve({ id: 'pay1', ...x }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    const agencyRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.agency === undefined
            ? { id: 'a1', commissionPct: '10.00' }
            : opts.agency,
        ),
    };
    const bookingRepo = { find: jest.fn().mockResolvedValue(opts.bookings ?? []) };
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue({ id: 'je1' }),
    };
    const service = new AgencyCommissionsService(
      commissionRepo as never,
      paymentRepo as never,
      agencyRepo as never,
      bookingRepo as never,
      accountingService as never,
    );
    return {
      service,
      commissionRepo,
      paymentRepo,
      agencyRepo,
      bookingRepo,
      accountingService,
    };
  }

  const booking = {
    id: 'b1111111-2222-3333-4444-555555555555',
    agencyId: 'a1',
    totalAmount: '1000000.00',
    currency: 'UZS',
    checkOut: '2026-09-10',
  };

  describe('accrueForBooking', () => {
    it("komissiyani hisoblab, bosh kitobga debet xarajat / kredit qarz yozadi", async () => {
      const { service, accountingService, commissionRepo } = createService();
      const result = await service.accrueForBooking('t1', 'p1', booking as never);

      expect(result?.amount).toBe('100000.00'); // 1,000,000 * 10%
      expect(commissionRepo.create.mock.calls[0][0]).toMatchObject({
        baseAmount: '1000000.00',
        commissionPct: '10.00',
        status: AgencyCommissionStatus.ACCRUED,
        // Kalendar kuni emas — check-out sanasi.
        accruedOn: '2026-09-10',
      });
      expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          debitSystemKey: 'agency_commission_expense',
          creditSystemKey: 'agency_commission_payable',
          amount: '100000.00',
          entryDate: '2026-09-10',
          sourceModule: 'agencies',
        }),
      );
    });

    it('agentliksiz bronda hech narsa yozmaydi', async () => {
      const { service, accountingService, commissionRepo } = createService();
      const result = await service.accrueForBooking(
        't1',
        'p1',
        { ...booking, agencyId: null } as never,
      );
      expect(result).toBeNull();
      expect(commissionRepo.save).not.toHaveBeenCalled();
      expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
    });

    it("🔴 idempotent — allaqachon yozilgan bron uchun ikkinchi provodka qilmaydi", async () => {
      const { service, accountingService, commissionRepo } = createService({
        existingCommission: { id: 'c1', amount: '100000.00' },
      });
      const result = await service.accrueForBooking('t1', 'p1', booking as never);
      expect(result).toMatchObject({ id: 'c1' });
      expect(commissionRepo.save).not.toHaveBeenCalled();
      expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
    });

    it("0% komissiyali agentlikda qator ochilmaydi (net-rate shartnomasi)", async () => {
      const { service, accountingService, commissionRepo } = createService({
        agency: { id: 'a1', commissionPct: '0.00' },
      });
      const result = await service.accrueForBooking('t1', 'p1', booking as never);
      expect(result).toBeNull();
      expect(commissionRepo.save).not.toHaveBeenCalled();
      expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
    });

    it("agentlik o'chirilgan bo'lsa check-out'ni to'smaydi", async () => {
      const { service } = createService({ agency: null });
      await expect(
        service.accrueForBooking('t1', 'p1', booking as never),
      ).resolves.toBeNull();
    });

    it('tiyinlar 2 xonagacha yaxlitlanadi', async () => {
      const { service } = createService({
        agency: { id: 'a1', commissionPct: '12.35' },
      });
      const result = await service.accrueForBooking(
        't1',
        'p1',
        { ...booking, totalAmount: '333333.33' } as never,
      );
      // 333333.33 * 12.35% = 41166.6662... -> 41166.67
      expect(result?.amount).toBe('41166.67');
    });
  });

  describe('getSummary', () => {
    it("hisoblangan, to'langan va qarz summalarini ajratadi", async () => {
      const { service } = createService({
        commissions: [
          {
            bookingId: 'b1',
            amount: '100000.00',
            baseAmount: '1000000.00',
            status: AgencyCommissionStatus.PAID,
          },
          {
            bookingId: 'b2',
            amount: '50000.00',
            baseAmount: '500000.00',
            status: AgencyCommissionStatus.ACCRUED,
          },
        ],
        bookings: [
          { id: 'b1', status: BookingStatus.CHECKED_OUT, totalAmount: '1000000.00', currency: 'UZS' },
          { id: 'b2', status: BookingStatus.CHECKED_OUT, totalAmount: '500000.00', currency: 'UZS' },
        ],
      });
      const s = await service.getSummary('t1', 'p1', 'a1');
      expect(s.accruedAmount).toBe('150000.00');
      expect(s.paidAmount).toBe('100000.00');
      expect(s.outstandingAmount).toBe('50000.00');
      expect(s.commissionOwed).toBe('50000.00'); // eski maydon = qarz
      expect(s.totalRevenue).toBe('1500000.00');
      expect(s.bookingCount).toBe(2);
    });

    it("🔴 bekor qilingan va no-show bronlar kutilayotgan summaga kirmaydi", async () => {
      const { service } = createService({
        commissions: [],
        bookings: [
          { id: 'b1', status: BookingStatus.CONFIRMED, totalAmount: '1000000.00', currency: 'UZS' },
          { id: 'b2', status: BookingStatus.CANCELLED, totalAmount: '9000000.00', currency: 'UZS' },
          { id: 'b3', status: BookingStatus.NO_SHOW, totalAmount: '9000000.00', currency: 'UZS' },
        ],
      });
      const s = await service.getSummary('t1', 'p1', 'a1');
      expect(s.projectedBookingCount).toBe(1);
      expect(s.projectedAmount).toBe('100000.00');
      expect(s.accruedAmount).toBe('0.00');
    });

    it("provodka joriy qilinishidan oldingi check-out'lar alohida (taxminiy) ko'rsatiladi", async () => {
      const { service } = createService({
        commissions: [],
        bookings: [
          { id: 'b-old', status: BookingStatus.CHECKED_OUT, totalAmount: '2000000.00', currency: 'UZS' },
        ],
      });
      const s = await service.getSummary('t1', 'p1', 'a1');
      expect(s.historicalBookingCount).toBe(1);
      expect(s.historicalEstimate).toBe('200000.00');
      // Muhimi: taxmin QARZGA qo'shilmaydi — bosh kitobda unday yozuv yo'q.
      expect(s.outstandingAmount).toBe('0.00');
    });

    it("mavjud bo'lmagan agentlik uchun NotFoundException", async () => {
      const { service } = createService({ agency: null });
      await expect(service.getSummary('t1', 'p1', 'yo-q')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('pay', () => {
    const accrued = [
      { id: 'c1', amount: '100000.00', currency: 'UZS', status: AgencyCommissionStatus.ACCRUED },
      { id: 'c2', amount: '50000.00', currency: 'UZS', status: AgencyCommissionStatus.ACCRUED },
    ];

    it("qarzni yopadi va teskari provodka yozadi (debet qarz / kredit bank)", async () => {
      const { service, paymentRepo, commissionRepo, accountingService } =
        createService({ commissions: accrued });

      const payment = await service.pay(
        't1',
        'p1',
        'a1',
        { method: AgencyPaymentMethod.BANK_TRANSFER, paidOn: '2026-09-30' },
        'u1',
      );

      expect(payment.amount).toBe('150000.00');
      expect(paymentRepo.create.mock.calls[0][0]).toMatchObject({
        method: AgencyPaymentMethod.BANK_TRANSFER,
        paidOn: '2026-09-30',
        createdByUserId: 'u1',
      });
      expect(commissionRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: AgencyCommissionStatus.PAID,
          paymentId: 'pay1',
        }),
      );
      expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          debitSystemKey: 'agency_commission_payable',
          creditSystemKey: 'bank_transfer',
          amount: '150000.00',
          entryDate: '2026-09-30',
        }),
      );
    });

    it("qisman to'lov — faqat tanlangan qatorlar yopiladi", async () => {
      const { service, commissionRepo } = createService({
        commissions: [accrued[0]],
      });
      const payment = await service.pay(
        't1',
        'p1',
        'a1',
        { commissionIds: ['c1'], method: AgencyPaymentMethod.CASH },
        'u1',
      );
      expect(payment.amount).toBe('100000.00');
      expect(commissionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agencyId: 'a1' }),
        }),
      );
    });

    it("🔴 allaqachon to'langan qatorni ikkinchi marta to'lab bo'lmaydi", async () => {
      const { service, accountingService } = createService({
        commissions: [
          { id: 'c1', amount: '100000.00', currency: 'UZS', status: AgencyCommissionStatus.PAID },
        ],
      });
      await expect(
        service.pay(
          't1',
          'p1',
          'a1',
          { commissionIds: ['c1'], method: AgencyPaymentMethod.CASH },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
    });

    it("boshqa agentlikning qatori so'ralsa rad etiladi", async () => {
      // Repository filtri tenant/property/agency bo'yicha — begona ID
      // shunchaki topilmaydi, va son mos kelmagani uchun xato beriladi.
      const { service } = createService({ commissions: [accrued[0]] });
      await expect(
        service.pay(
          't1',
          'p1',
          'a1',
          { commissionIds: ['c1', 'begona'], method: AgencyPaymentMethod.CASH },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("to'lanmagan komissiya bo'lmasa xato beradi", async () => {
      const { service } = createService({ commissions: [] });
      await expect(
        service.pay('t1', 'p1', 'a1', { method: AgencyPaymentMethod.CASH }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
