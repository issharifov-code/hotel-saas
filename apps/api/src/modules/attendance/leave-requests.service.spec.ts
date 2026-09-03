import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestStatus, LeaveType } from './entities/leave-request.entity';

describe('LeaveRequestsService', () => {
  function createService(
    opts: {
      existingRequest?: Record<string, unknown> | null;
      user?: Record<string, unknown> | null;
    } = {},
  ) {
    const baseRequest = {
      id: 'lr-1',
      tenantId: 't1',
      propertyId: 'prop-1',
      userId: 'u1',
      status: LeaveRequestStatus.PENDING,
      ...opts.existingRequest,
    };
    const leaveRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest
        .fn()
        .mockResolvedValue(opts.existingRequest === null ? null : baseRequest),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'lr-1', ...data }),
      ),
    };
    const usersService = {
      findById: jest
        .fn()
        .mockResolvedValue(
          opts.user === undefined ? { id: 'u1', tenantId: 't1' } : opts.user,
        ),
    };

    const service = new LeaveRequestsService(
      leaveRepo as never,
      usersService as never,
    );
    return { service, leaveRepo, usersService };
  }

  describe('list', () => {
    it("filtrlar berilmasa where'ga undefined qiymatli xususiyat qo'shmaydi (TypeORM buni Undefined value xatosi bilan yiqitardi)", async () => {
      const { service, leaveRepo } = createService();
      await service.list('t1', 'prop-1', {});
      expect(leaveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1', propertyId: 'prop-1' },
        }),
      );
    });

    it("faqat berilgan filtrlarni (masalan status) where'ga qo'shadi", async () => {
      const { service, leaveRepo } = createService();
      await service.list('t1', 'prop-1', {
        status: LeaveRequestStatus.PENDING,
      });
      expect(leaveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 't1',
            propertyId: 'prop-1',
            status: LeaveRequestStatus.PENDING,
          },
        }),
      );
    });
  });

  describe('create', () => {
    it("mavjud bo'lmagan xodim uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({ user: null });
      await expect(
        service.create('t1', 'prop-1', 'requester-1', {
          userId: 'u1',
          leaveType: LeaveType.VACATION,
          startDate: '2026-09-10',
          endDate: '2026-09-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("tugash sanasi boshlanish sanasidan oldin bo'lsa BadRequestException tashlaydi", async () => {
      const { service } = createService();
      await expect(
        service.create('t1', 'prop-1', 'requester-1', {
          userId: 'u1',
          leaveType: LeaveType.VACATION,
          startDate: '2026-09-15',
          endDate: '2026-09-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("to'g'ri ma'lumotlar bilan PENDING holatida so'rov yaratadi", async () => {
      const { service, leaveRepo } = createService();
      const result = await service.create('t1', 'prop-1', 'requester-1', {
        userId: 'u1',
        leaveType: LeaveType.SICK,
        startDate: '2026-09-10',
        endDate: '2026-09-12',
        reason: 'Shifokor tavsiyasi',
      });
      expect(leaveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          leaveType: LeaveType.SICK,
          status: LeaveRequestStatus.PENDING,
          requestedByUserId: 'requester-1',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ status: LeaveRequestStatus.PENDING }),
      );
    });
  });

  describe('approve/reject/cancel', () => {
    it("PENDING bo'lmagan so'rovni tasdiqlashga urinishda ConflictException tashlaydi", async () => {
      const { service } = createService({
        existingRequest: { status: LeaveRequestStatus.APPROVED },
      });
      await expect(
        service.approve('t1', 'prop-1', 'lr-1', 'approver-1', {}),
      ).rejects.toThrow(ConflictException);
    });

    it("mavjud bo'lmagan so'rov uchun NotFoundException tashlaydi", async () => {
      const { service } = createService({ existingRequest: null });
      await expect(
        service.approve('t1', 'prop-1', 'lr-x', 'approver-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("PENDING so'rovni to'g'ri tasdiqlaydi", async () => {
      const { service, leaveRepo } = createService();
      const result = await service.approve(
        't1',
        'prop-1',
        'lr-1',
        'approver-1',
        {
          notes: 'Yaxshi',
        },
      );
      expect(result).toEqual(
        expect.objectContaining({
          status: LeaveRequestStatus.APPROVED,
          decidedByUserId: 'approver-1',
          decisionNotes: 'Yaxshi',
        }),
      );
      expect(leaveRepo.save).toHaveBeenCalled();
    });

    it("PENDING so'rovni to'g'ri rad etadi", async () => {
      const { service } = createService();
      const result = await service.reject(
        't1',
        'prop-1',
        'lr-1',
        'approver-1',
        {},
      );
      expect(result).toEqual(
        expect.objectContaining({ status: LeaveRequestStatus.REJECTED }),
      );
    });

    it("PENDING so'rovni bekor qiladi", async () => {
      const { service } = createService();
      const result = await service.cancel('t1', 'prop-1', 'lr-1');
      expect(result).toEqual(
        expect.objectContaining({ status: LeaveRequestStatus.CANCELLED }),
      );
    });
  });
});
