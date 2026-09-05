import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserStatus } from './entities/user.entity';

describe('UsersService', () => {
  function createService(
    opts: {
      existingByEmail?: Record<string, unknown> | null;
      findOneByResult?: Record<string, unknown> | null;
    } = {},
  ) {
    const repo = {
      findOneBy: jest
        .fn()
        .mockImplementation((where: Record<string, unknown>) => {
          // createUser's duplicate-email check vs resetPassword/updateStatus's
          // tenant-scoped lookup ikkalasi ham findOneBy chaqiradi — testda
          // qaysi biri ekanini `where` shakliga qarab ajratamiz.
          if ('email' in where)
            return Promise.resolve(opts.existingByEmail ?? null);
          return Promise.resolve(opts.findOneByResult ?? null);
        }),
      create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
        id: 'new-user',
        ...data,
      })),
      save: jest
        .fn()
        .mockImplementation((entity: Record<string, unknown>) =>
          Promise.resolve(entity),
        ),
    };
    // 🔴 2026-09-05: `users` jadvalida RLS bor (migratsiya 1789300000000),
    // shuning uchun servis har bir metodda O'Z tranzaksiyasini ochib,
    // ichida `set_config` qiladi (RolesService/TenantsService naqshi).
    // Mock'da tranzaksiya shunchaki callback'ni bir xil repo bilan
    // chaqiradi — mantiq o'zgarmaydi, faqat manager orqali o'tadi.
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue(repo),
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    (repo as Record<string, unknown>).manager = manager;
    const service = new UsersService(repo as never);
    return { service, repo };
  }

  describe('createUser', () => {
    it("email allaqachon shu tenant'da mavjud bo'lsa ConflictException tashlaydi", async () => {
      const { service } = createService({
        existingByEmail: { id: 'existing' },
      });
      await expect(
        service.createUser({
          tenantId: 't1',
          email: 'a@b.com',
          password: 'x',
          fullName: 'A',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('yangi foydalanuvchini ACTIVE holatda yaratadi', async () => {
      const { service, repo } = createService({ existingByEmail: null });
      const user = await service.createUser({
        tenantId: 't1',
        email: 'New@Example.com',
        password: 'secret123',
        fullName: 'Yangi Xodim',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(user.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('resetPassword — administrator tomonidan parol tiklash', () => {
    it("boshqa tenant'ning xodimini topolmasa NotFoundException tashlaydi (tenant-izolyatsiya)", async () => {
      const { service } = createService({ findOneByResult: null });
      await expect(
        service.resetPassword('t1', 'someone-elses-user', 'newpass123'),
      ).rejects.toThrow(NotFoundException);
    });

    it("o'z tenant'idagi xodim uchun parolni muvaffaqiyatli yangilaydi", async () => {
      const { service, repo } = createService({
        findOneByResult: { id: 'u1', tenantId: 't1', passwordHash: 'old-hash' },
      });
      await service.resetPassword('t1', 'u1', 'newpass123');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.not.stringMatching(/^old-hash$/) as string,
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it("boshqa tenant'ning xodimini topolmasa NotFoundException tashlaydi", async () => {
      const { service } = createService({ findOneByResult: null });
      await expect(
        service.updateStatus('t1', 'someone-elses-user', UserStatus.DISABLED),
      ).rejects.toThrow(NotFoundException);
    });

    it("xodim holatini DISABLED ga o'zgartiradi", async () => {
      const { service } = createService({
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          status: UserStatus.ACTIVE,
        },
      });
      const updated = await service.updateStatus(
        't1',
        'u1',
        UserStatus.DISABLED,
      );
      expect(updated.status).toBe(UserStatus.DISABLED);
    });
  });
});
