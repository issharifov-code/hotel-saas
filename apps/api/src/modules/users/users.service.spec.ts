import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserStatus } from './entities/user.entity';

describe('UsersService', () => {
  function createService(
    opts: {
      existingByEmail?: Record<string, unknown> | null;
      findOneByResult?: Record<string, unknown> | null;
      // `getAuthState` uchun: bazadan qaytadigan qator (yoki null).
      authStateRow?: Record<string, unknown> | null;
    } = {},
  ) {
    // `getAuthState` QueryBuilder ishlatadi (faqat ikkita ustun o'qish
    // uchun) — zanjir shu yerda mock qilinadi. `getOne` chaqiruvlari
    // sonini sanash keshni tekshirish uchun kerak.
    const getOne = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(opts.authStateRow ?? null),
      );
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
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
    return { service, repo, getOne };
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

  // 🔴 Token bekor qilish (2026-09-05, auditning oxirgi ochiq topilmasi).
  // Avval bloklangan xodimning tokeni muddati tugagunicha (8 soat)
  // ishlayverardi. Endi `token_version` hisoblagichi tokendagi `tv` bilan
  // solishtiriladi — hisoblagich oshsa, eski tokenlar kuchini yo'qotadi.
  describe('token_version — sessiyani bekor qilish', () => {
    it("xodim bloklanganda hisoblagichni oshiradi (eski token kuchsizlanadi)", async () => {
      const { service } = createService({
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          status: UserStatus.ACTIVE,
          tokenVersion: 3,
        },
      });
      const updated = await service.updateStatus(
        't1',
        'u1',
        UserStatus.DISABLED,
      );
      expect(updated.tokenVersion).toBe(4);
    });

    it("bir xil status qayta yozilsa hisoblagich oshmaydi (sessiya uzilmaydi)", async () => {
      const { service } = createService({
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          status: UserStatus.ACTIVE,
          tokenVersion: 3,
        },
      });
      const updated = await service.updateStatus('t1', 'u1', UserStatus.ACTIVE);
      expect(updated.tokenVersion).toBe(3);
    });

    it('parol almashtirilganda hisoblagichni oshiradi', async () => {
      const { service, repo } = createService({
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          passwordHash: 'old-hash',
          tokenVersion: 0,
        },
      });
      await service.resetPassword('t1', 'u1', 'newpass123');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
      );
    });
  });

  describe("getAuthState — har so'rovdagi tekshiruv", () => {
    it('holat va hisoblagichni qaytaradi', async () => {
      const { service } = createService({
        authStateRow: { id: 'u1', status: UserStatus.ACTIVE, tokenVersion: 2 },
      });
      await expect(service.getAuthState('u1')).resolves.toEqual({
        status: UserStatus.ACTIVE,
        tokenVersion: 2,
      });
    });

    it("foydalanuvchi topilmasa null qaytaradi", async () => {
      const { service } = createService({ authStateRow: null });
      await expect(service.getAuthState('yoq')).resolves.toBeNull();
    });

    it('ketma-ket chaqiruvlarni keshdan beradi (bazaga bir marta boradi)', async () => {
      const { service, getOne } = createService({
        authStateRow: { id: 'u1', status: UserStatus.ACTIVE, tokenVersion: 0 },
      });
      await service.getAuthState('u1');
      await service.getAuthState('u1');
      await service.getAuthState('u1');
      expect(getOne).toHaveBeenCalledTimes(1);
    });

    it("status o'zgargach keshni tozalaydi — keyingi chaqiruv bazaga boradi", async () => {
      const { service, getOne } = createService({
        authStateRow: { id: 'u1', status: UserStatus.ACTIVE, tokenVersion: 0 },
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          status: UserStatus.ACTIVE,
          tokenVersion: 0,
        },
      });
      await service.getAuthState('u1');
      expect(getOne).toHaveBeenCalledTimes(1);

      await service.updateStatus('t1', 'u1', UserStatus.DISABLED);
      await service.getAuthState('u1');
      expect(getOne).toHaveBeenCalledTimes(2);
    });

    it('parol almashtirilgach ham keshni tozalaydi', async () => {
      const { service, getOne } = createService({
        authStateRow: { id: 'u1', status: UserStatus.ACTIVE, tokenVersion: 0 },
        findOneByResult: {
          id: 'u1',
          tenantId: 't1',
          passwordHash: 'old-hash',
          tokenVersion: 0,
        },
      });
      await service.getAuthState('u1');
      await service.resetPassword('t1', 'u1', 'newpass123');
      await service.getAuthState('u1');
      expect(getOne).toHaveBeenCalledTimes(2);
    });
  });

  // 🔬 MAOSH VA PAYROLL RO'YXATI (2026-09-05).
  //
  // `listActiveWithSalary` — PayrollService.createRun uchun "kim maosh
  // oladi" degan savolga javob beradigan YAGONA joy. Undagi filtr
  // to'g'ridan-to'g'ri pulga aylanadi:
  //
  //   * bloklangan (ishdan bo'shagan) xodim ro'yxatda qolsa — unga
  //     payslip yoziladi va to'lov majburiyati paydo bo'ladi;
  //   * maoshi belgilanmagan xodim ro'yxatga tushsa — payslip'da
  //     summa `null` bo'lib, hisob-kitob buziladi;
  //   * haqiqiy xodim tushib qolsa — u shu oy maoshsiz qoladi va buni
  //     faqat o'zi sezadi.
  describe('maosh va payroll ro\'yxati', () => {
    function withUsers(users: Array<Record<string, unknown>>) {
      const repo = {
        find: jest.fn().mockResolvedValue(users),
        findOneBy: jest.fn().mockResolvedValue(users[0] ?? null),
        save: jest.fn((e: unknown) => Promise.resolve(e)),
      };
      const manager = {
        query: jest.fn().mockResolvedValue(undefined),
        getRepository: jest.fn().mockReturnValue(repo),
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
      };
      (repo as Record<string, unknown>).manager = manager;
      return { service: new UsersService(repo as never), repo };
    }

    const user = (over: Record<string, unknown> = {}) => ({
      id: 'u1',
      fullName: 'Xodim',
      status: UserStatus.ACTIVE,
      salaryType: 'monthly',
      salaryAmount: '5000000.00',
      ...over,
    });

    it("maoshi belgilanmagan xodim payroll ro'yxatiga tushmaydi", async () => {
      const { service } = withUsers([
        user({ id: 'bor' }),
        user({ id: 'turi-yoq', salaryType: null }),
        user({ id: 'summasi-yoq', salaryAmount: null }),
      ]);

      const list = await service.listActiveWithSalary('t1');

      expect(list.map((u) => u.id)).toEqual(['bor']);
    });

    // Faol bo'lmagan xodimlarni bazaning O'ZI chiqarib tashlaydi
    // (`where: { status: ACTIVE }`) — shart so'rovda ekanini
    // tekshiramiz, aks holda filtr jimgina yo'qolib ketishi mumkin.
    it("so'rov faqat faol xodimlarni oladi", async () => {
      const { service, repo } = withUsers([user()]);

      await service.listActiveWithSalary('t1');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: UserStatus.ACTIVE }),
        }),
      );
    });

    it("maosh belgilanganda tur ham, summa ham saqlanadi", async () => {
      const { service, repo } = withUsers([user({ salaryType: null, salaryAmount: null })]);

      await service.setSalary('t1', 'u1', 'hourly' as never, '25000.00');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ salaryType: 'hourly', salaryAmount: '25000.00' }),
      );
    });

    it("boshqa tenantning xodimiga maosh belgilab bo'lmaydi", async () => {
      const { service, repo } = withUsers([]);
      repo.findOneBy.mockResolvedValue(null);

      await expect(
        service.setSalary('t1', 'begona', 'monthly' as never, '1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("mavjud bo'lmagan xodimning maoshini o'qib bo'lmaydi", async () => {
      const { service, repo } = withUsers([]);
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.getSalary('t1', 'yoq')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

});
