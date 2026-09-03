import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollRunStatus } from './entities/payroll-run.entity';
import { SalaryType } from '../users/entities/user.entity';

describe('PayrollService', () => {
  function createService(
    opts: {
      existingRun?: Record<string, unknown> | null;
      employees?: Record<string, unknown>[];
      run?: Record<string, unknown>;
      entries?: Record<string, unknown>[];
      monthlyHours?: number;
    } = {},
  ) {
    const baseRun = {
      id: 'run-1',
      tenantId: 't1',
      propertyId: 'prop-1',
      periodYear: 2026,
      periodMonth: 9,
      status: PayrollRunStatus.DRAFT,
      totalAmount: '0.00',
      entries: opts.entries ?? [],
      ...opts.run,
    };

    const runRepo = {
      findOneBy: jest.fn().mockResolvedValue(opts.existingRun ?? null),
      findOne: jest.fn().mockResolvedValue({
        ...baseRun,
        entries: [...(baseRun.entries as unknown[])],
      }),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'run-1', ...data }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const entryRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Array.isArray(data)
          ? Promise.resolve(
              data.map((d, i) => ({ id: `entry-${i}`, ...(d as object) })),
            )
          : Promise.resolve({ id: 'entry-0', ...(data as object) }),
      ),
      find: jest.fn().mockResolvedValue(opts.entries ?? []),
    };
    const usersService = {
      listActiveWithSalary: jest.fn().mockResolvedValue(opts.employees ?? []),
    };
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue({ id: 'je-1' }),
    };
    const attendanceService = {
      getMonthlyHours: jest.fn().mockResolvedValue(opts.monthlyHours ?? 0),
    };

    const service = new PayrollService(
      runRepo as never,
      entryRepo as never,
      usersService as never,
      accountingService as never,
      attendanceService as never,
    );
    return {
      service,
      runRepo,
      entryRepo,
      usersService,
      accountingService,
      attendanceService,
    };
  }

  describe('createRun', () => {
    it("shu davr uchun payroll allaqachon mavjud bo'lsa ConflictException tashlaydi", async () => {
      const { service } = createService({ existingRun: { id: 'run-0' } });
      await expect(
        service.createRun('t1', 'prop-1', 'user-1', {
          periodYear: 2026,
          periodMonth: 9,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('maoshi belgilangan faol xodim topilmasa BadRequestException tashlaydi', async () => {
      const { service } = createService({ employees: [] });
      await expect(
        service.createRun('t1', 'prop-1', 'user-1', {
          periodYear: 2026,
          periodMonth: 9,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("oylik va soatlik xodimlar uchun to'g'ri boshlang'ich qatorlar yaratadi", async () => {
      const { service, entryRepo, runRepo } = createService({
        employees: [
          {
            id: 'u1',
            fullName: 'Aziz Aliyev',
            salaryType: SalaryType.MONTHLY,
            salaryAmount: '3000000.00',
          },
          {
            id: 'u2',
            fullName: 'Malika Karimova',
            salaryType: SalaryType.HOURLY,
            salaryAmount: '25000.00',
          },
        ],
      });

      await service.createRun('t1', 'prop-1', 'user-1', {
        periodYear: 2026,
        periodMonth: 9,
      });

      expect(entryRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'u1',
          salaryType: SalaryType.MONTHLY,
          rateSnapshot: '3000000.00',
          hoursWorked: null,
          grossAmount: '3000000.00',
          netAmount: '3000000.00',
        }),
        expect.objectContaining({
          userId: 'u2',
          salaryType: SalaryType.HOURLY,
          rateSnapshot: '25000.00',
          hoursWorked: '0.00',
          grossAmount: '0.00',
          netAmount: '0.00',
        }),
      ]);
      // Faqat MONTHLY xodimning summasi boshlang'ich jamiga kiradi (HOURLY hali 0).
      expect(runRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ totalAmount: '3000000.00' }),
      );
    });

    it('HOURLY xodim uchun Attendance moduli qayd etgan oylik soatlarni avtomatik taklif qiladi', async () => {
      const { service, entryRepo, attendanceService } = createService({
        employees: [
          {
            id: 'u2',
            fullName: 'Malika Karimova',
            salaryType: SalaryType.HOURLY,
            salaryAmount: '25000.00',
          },
        ],
        monthlyHours: 160,
      });

      await service.createRun('t1', 'prop-1', 'user-1', {
        periodYear: 2026,
        periodMonth: 9,
      });

      expect(attendanceService.getMonthlyHours).toHaveBeenCalledWith(
        't1',
        'prop-1',
        'u2',
        2026,
        9,
      );
      expect(entryRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'u2',
          hoursWorked: '160.00',
          grossAmount: '4000000.00',
          netAmount: '4000000.00',
        }),
      ]);
    });
  });

  describe('updateEntry', () => {
    it("DRAFT bo'lmagan payrollni tahrirlashga urinishda ConflictException tashlaydi", async () => {
      const { service } = createService({
        run: { status: PayrollRunStatus.FINALIZED },
        entries: [
          {
            id: 'entry-1',
            salaryType: SalaryType.HOURLY,
            rateSnapshot: '25000.00',
            grossAmount: '0.00',
            adjustmentAmount: '0.00',
          },
        ],
      });
      await expect(
        service.updateEntry('t1', 'prop-1', 'run-1', 'entry-1', {
          hoursWorked: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("mavjud bo'lmagan payslip uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({ entries: [] });
      await expect(
        service.updateEntry('t1', 'prop-1', 'run-1', 'entry-x', {
          hoursWorked: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('MONTHLY xodim uchun soat kiritishga urinishda BadRequestException tashlaydi', async () => {
      const { service } = createService({
        entries: [
          {
            id: 'entry-1',
            salaryType: SalaryType.MONTHLY,
            rateSnapshot: '3000000.00',
            grossAmount: '3000000.00',
            adjustmentAmount: '0.00',
          },
        ],
      });
      await expect(
        service.updateEntry('t1', 'prop-1', 'run-1', 'entry-1', {
          hoursWorked: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("HOURLY xodim uchun soat x stavka bo'yicha grossAmount'ni to'g'ri hisoblaydi", async () => {
      const { service, entryRepo } = createService({
        entries: [
          {
            id: 'entry-1',
            salaryType: SalaryType.HOURLY,
            rateSnapshot: '25000.00',
            grossAmount: '0.00',
            adjustmentAmount: '0.00',
          },
        ],
      });

      const result = await service.updateEntry(
        't1',
        'prop-1',
        'run-1',
        'entry-1',
        { hoursWorked: 160 },
      );

      expect(result).toEqual(
        expect.objectContaining({
          hoursWorked: '160.00',
          grossAmount: '4000000.00',
          netAmount: '4000000.00',
        }),
      );
      expect(entryRepo.save).toHaveBeenCalled();
    });

    it("manfiy tuzatish (ushlab qolish) netAmount'ni kamaytiradi, lekin 0'dan pastga tushirmaydi", async () => {
      const { service } = createService({
        entries: [
          {
            id: 'entry-1',
            salaryType: SalaryType.MONTHLY,
            rateSnapshot: '100.00',
            grossAmount: '100.00',
            adjustmentAmount: '0.00',
          },
        ],
      });

      const result = await service.updateEntry(
        't1',
        'prop-1',
        'run-1',
        'entry-1',
        {
          adjustmentAmount: -500,
          adjustmentNote: "Ortiqcha to'lovni qaytarish",
        },
      );

      expect(result).toEqual(expect.objectContaining({ netAmount: '0.00' }));
    });
  });

  describe('finalizeRun', () => {
    it("DRAFT bo'lmagan payrollni yakunlashga urinishda ConflictException tashlaydi", async () => {
      const { service } = createService({
        run: { status: PayrollRunStatus.FINALIZED },
      });
      await expect(
        service.finalizeRun('t1', 'prop-1', 'run-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it("6109/2300 tizim hisoblariga to'g'ri jamlangan provodka yozadi va FINALIZED holatiga o'tkazadi", async () => {
      const { service, accountingService, runRepo } = createService({
        run: { status: PayrollRunStatus.DRAFT, totalAmount: '5000000.00' },
      });

      const result = await service.finalizeRun(
        't1',
        'prop-1',
        'run-1',
        'user-1',
      );

      expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          propertyId: 'prop-1',
          sourceModule: 'payroll',
          sourceId: 'run-1',
          debitSystemKey: 'payroll_expense',
          creditSystemKey: 'payroll_liability',
          amount: '5000000.00',
        }),
      );
      expect(runRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PayrollRunStatus.FINALIZED,
          finalizedByUserId: 'user-1',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('markPaid', () => {
    it("FINALIZED bo'lmagan payrollni to'landi deb belgilashga urinishda ConflictException tashlaydi", async () => {
      const { service } = createService({
        run: { status: PayrollRunStatus.DRAFT },
      });
      await expect(
        service.markPaid('t1', 'prop-1', 'run-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it("payroll_liability'dan cash'ga to'g'ri provodka yozadi va PAID holatiga o'tkazadi", async () => {
      const { service, accountingService, runRepo } = createService({
        run: { status: PayrollRunStatus.FINALIZED, totalAmount: '5000000.00' },
      });

      const result = await service.markPaid('t1', 'prop-1', 'run-1', 'user-1');

      expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          debitSystemKey: 'payroll_liability',
          creditSystemKey: 'cash',
          amount: '5000000.00',
        }),
      );
      expect(runRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PayrollRunStatus.PAID }),
      );
      expect(result).toBeDefined();
    });
  });
});
