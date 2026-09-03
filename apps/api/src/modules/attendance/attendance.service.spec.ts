import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceStatus } from './entities/attendance-record.entity';

describe('AttendanceService', () => {
  function createService(
    opts: {
      existingRecord?: Record<string, unknown> | null;
      records?: Record<string, unknown>[];
      user?: Record<string, unknown> | null;
      tenantUsers?: Record<string, unknown>[];
    } = {},
  ) {
    const recordRepo = {
      find: jest.fn().mockResolvedValue(opts.records ?? []),
      findOneBy: jest.fn().mockResolvedValue(opts.existingRecord ?? null),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'rec-1', ...data }),
      ),
    };
    const usersService = {
      findById: jest
        .fn()
        .mockResolvedValue(
          opts.user === undefined
            ? { id: 'u1', tenantId: 't1', fullName: 'Aziz Aliyev' }
            : opts.user,
        ),
      listByTenant: jest.fn().mockResolvedValue(opts.tenantUsers ?? []),
    };

    const service = new AttendanceService(
      recordRepo as never,
      usersService as never,
    );
    return { service, recordRepo, usersService };
  }

  describe('listStaffRoster', () => {
    it('faqat ACTIVE xodimlarni, faqat ism+maosh turi bilan qaytaradi (maosh summasisiz)', async () => {
      const { service } = createService({
        tenantUsers: [
          {
            id: 'u1',
            fullName: 'Aziz Aliyev',
            status: 'active',
            salaryType: 'monthly',
            salaryAmount: '3000000.00',
          },
          {
            id: 'u2',
            fullName: 'Nofaol Xodim',
            status: 'disabled',
            salaryType: null,
            salaryAmount: null,
          },
        ],
      });
      const roster = await service.listStaffRoster('t1');
      expect(roster).toEqual([
        { id: 'u1', fullName: 'Aziz Aliyev', salaryType: 'monthly' },
      ]);
    });
  });

  describe('upsert', () => {
    it("mavjud bo'lmagan xodim uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({ user: null });
      await expect(
        service.upsert('t1', 'prop-1', 'recorder-1', 'u1', '2026-09-05', {
          status: AttendanceStatus.PRESENT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("boshqa tenant'ga tegishli xodim uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({
        user: { id: 'u1', tenantId: 't2', fullName: 'Boshqa' },
      });
      await expect(
        service.upsert('t1', 'prop-1', 'recorder-1', 'u1', '2026-09-05', {
          status: AttendanceStatus.PRESENT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("yozuv mavjud bo'lmasa yangi yaratadi", async () => {
      const { service, recordRepo } = createService({ existingRecord: null });

      const result = await service.upsert(
        't1',
        'prop-1',
        'recorder-1',
        'u1',
        '2026-09-05',
        { status: AttendanceStatus.PRESENT, hoursWorked: 8 },
      );

      // Eslatma: `create()` orqali qaytarilgan obyekt shu funksiya ichida
      // keyinroq to'g'ridan-to'g'ri mutatsiya qilinadi (status/hoursWorked/...
      // o'rnatiladi) — shuning uchun bu yerda faqat identifikatsiya
      // maydonlarining SUBSET sifatida borligini tekshiramiz (objectContaining),
      // aniq tenglik emas (u keyingi mutatsiyalarni ham qamrab olib xato beradi).
      expect(recordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          propertyId: 'prop-1',
          userId: 'u1',
          date: '2026-09-05',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          status: AttendanceStatus.PRESENT,
          hoursWorked: '8.00',
          recordedByUserId: 'recorder-1',
        }),
      );
    });

    it("yozuv mavjud bo'lsa yangilaydi (bir xil sana/xodim uchun ikkinchi marta yubormaydi)", async () => {
      const { service, recordRepo } = createService({
        existingRecord: {
          id: 'rec-1',
          tenantId: 't1',
          propertyId: 'prop-1',
          userId: 'u1',
          date: '2026-09-05',
          status: AttendanceStatus.ABSENT,
          hoursWorked: null,
        },
      });

      const result = await service.upsert(
        't1',
        'prop-1',
        'recorder-1',
        'u1',
        '2026-09-05',
        { status: AttendanceStatus.PRESENT, hoursWorked: 6 },
      );

      expect(recordRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'rec-1',
          status: AttendanceStatus.PRESENT,
          hoursWorked: '6.00',
        }),
      );
    });

    it('hoursWorked berilmasa null qiladi (masalan ABSENT holati uchun)', async () => {
      const { service } = createService();
      const result = await service.upsert(
        't1',
        'prop-1',
        'recorder-1',
        'u1',
        '2026-09-05',
        { status: AttendanceStatus.ABSENT },
      );
      expect(result).toEqual(expect.objectContaining({ hoursWorked: null }));
    });
  });

  describe('getMonthlyHours', () => {
    it("noto'g'ri oy (0 yoki 13) uchun BadRequestException tashlaydi", async () => {
      const { service } = createService();
      await expect(
        service.getMonthlyHours('t1', 'prop-1', 'u1', 2026, 0),
      ).rejects.toThrow();
      await expect(
        service.getMonthlyHours('t1', 'prop-1', 'u1', 2026, 13),
      ).rejects.toThrow();
    });

    it("shu oy uchun barcha yozuvlarning hoursWorked yig'indisini qaytaradi", async () => {
      const { service } = createService({
        records: [
          { hoursWorked: '8.00' },
          { hoursWorked: '7.50' },
          { hoursWorked: null }, // masalan ABSENT kuni
        ],
      });
      const total = await service.getMonthlyHours(
        't1',
        'prop-1',
        'u1',
        2026,
        9,
      );
      expect(total).toBe(15.5);
    });

    it("yozuv umuman bo'lmasa 0 qaytaradi", async () => {
      const { service } = createService({ records: [] });
      const total = await service.getMonthlyHours(
        't1',
        'prop-1',
        'u1',
        2026,
        9,
      );
      expect(total).toBe(0);
    });
  });
});
