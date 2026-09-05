import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserStatus } from '../users/entities/user.entity';

// AuthService.login endi ikkita rejimda ishlaydi: `subdomain` berilsa eski
// (aniq tenant) yo'l, berilmasa email orqali avtomatik aniqlash (Login
// sahifasi qayta dizayni, 2026-09) — shu jumladan bir xil email+parol bir
// nechta tenant'da ishlab qolgan (kamdan-kam) holatni ham tekshiramiz.
describe('AuthService', () => {
  function makeUser(
    overrides: Partial<{
      id: string;
      tenantId: string | null;
      email: string;
      fullName: string;
      isPlatformAdmin: boolean;
      status: UserStatus;
      tokenVersion: number;
    }>,
  ) {
    const tenantId: string | null =
      'tenantId' in overrides
        ? (overrides.tenantId as string | null)
        : 'tenant-1';
    return {
      id: overrides.id ?? 'user-1',
      tenantId,
      email: overrides.email ?? 'owner@example.com',
      passwordHash: 'hashed',
      fullName: overrides.fullName ?? 'Test User',
      status: overrides.status ?? UserStatus.ACTIVE,
      isPlatformAdmin: overrides.isPlatformAdmin ?? false,
      tokenVersion: overrides.tokenVersion ?? 0,
    };
  }

  function createService(opts: {
    findAllByEmailResult?: ReturnType<typeof makeUser>[];
    findByEmailAndTenantResult?: ReturnType<typeof makeUser> | null;
    validPasswordForUserIds?: string[];
    tenantsById?: Record<
      string,
      { id: string; subdomain: string; name: string; hasSampleData?: boolean }
    >;
    tenantBySubdomain?: {
      id: string;
      subdomain: string;
      name: string;
      hasSampleData?: boolean;
    } | null;
  }) {
    const usersService = {
      findAllByEmail: jest
        .fn()
        .mockResolvedValue(opts.findAllByEmailResult ?? []),
      findByEmailAndTenant: jest
        .fn()
        .mockResolvedValue(opts.findByEmailAndTenantResult ?? null),
      validatePassword: jest
        .fn()
        .mockImplementation((user: { id: string }) =>
          Promise.resolve(
            (opts.validPasswordForUserIds ?? []).includes(user.id),
          ),
        ),
    };
    const tenantsService = {
      findBySubdomain: jest
        .fn()
        .mockResolvedValue(opts.tenantBySubdomain ?? null),
      findById: jest.fn().mockImplementation((id: string) => {
        const t = opts.tenantsById?.[id];
        if (!t) throw new Error(`unexpected tenant id in test: ${id}`);
        return Promise.resolve(t);
      }),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };

    const service = new AuthService(
      usersService as never,
      tenantsService as never,
      {} as never, // rolesService — login yo'lida ishlatilmaydi
      {} as never, // sampleDataService — login yo'lida ishlatilmaydi
      jwtService as never,
    );
    return { service, usersService, tenantsService, jwtService };
  }

  describe("login — subdomain berilganda (eski yo'l)", () => {
    it("to'g'ri email+parol bilan token qaytaradi", async () => {
      const user = makeUser({ id: 'u1', tenantId: 't1' });
      const { service } = createService({
        tenantBySubdomain: { id: 't1', subdomain: 'demo', name: 'Demo Hotel' },
        findByEmailAndTenantResult: user,
        validPasswordForUserIds: ['u1'],
      });

      const res = await service.login({
        subdomain: 'demo',
        email: user.email,
        password: 'secret',
      });

      expect(res).toMatchObject({
        accessToken: 'signed-jwt',
        user: { id: 'u1', tenantId: 't1', tenantSubdomain: 'demo' },
      });
    });

    // 🔴 Token bekor qilish (2026-09-05): login paytidagi `token_version`
    // tokenga muhrlanadi. Agar `tv` tokenga tushmay qolsa, `JwtStrategy`
    // uni 0 deb hisoblaydi va hisoblagichi oshgan foydalanuvchi umuman
    // kira olmaydi — ya'ni bu maydonning yo'qolishi jimgina buzilish
    // bo'lardi.
    it("tokenga foydalanuvchining token_version qiymatini yozadi", async () => {
      const user = makeUser({ id: 'u1', tenantId: 't1', tokenVersion: 7 });
      const { service, jwtService } = createService({
        tenantBySubdomain: { id: 't1', subdomain: 'demo', name: 'Demo Hotel' },
        findByEmailAndTenantResult: user,
        validPasswordForUserIds: ['u1'],
      });

      await service.login({
        subdomain: 'demo',
        email: user.email,
        password: 'secret',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', tv: 7 }),
      );
    });

    // 🔴 2026-09-05 (audit): `User.status` login yo'lida umuman o'qilmasdi —
    // bloklangan xodim eski paroli bilan cheksiz yangi token olib kiraverardi.
    it("bloklangan (disabled) foydalanuvchi to'g'ri parol bilan ham kira olmaydi", async () => {
      const user = makeUser({
        id: 'u1',
        tenantId: 't1',
        status: UserStatus.DISABLED,
      });
      const { service } = createService({
        tenantBySubdomain: { id: 't1', subdomain: 'demo', name: 'Demo Hotel' },
        findByEmailAndTenantResult: user,
        validPasswordForUserIds: ['u1'],
      });

      await expect(
        service.login({
          subdomain: 'demo',
          email: user.email,
          password: 'secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("hali faollashtirilmagan (invited) foydalanuvchi ham kira olmaydi", async () => {
      const user = makeUser({
        id: 'u1',
        tenantId: 't1',
        status: UserStatus.INVITED,
      });
      const { service } = createService({
        tenantBySubdomain: { id: 't1', subdomain: 'demo', name: 'Demo Hotel' },
        findByEmailAndTenantResult: user,
        validPasswordForUserIds: ['u1'],
      });

      await expect(
        service.login({
          subdomain: 'demo',
          email: user.email,
          password: 'secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('subdomain topilmasa 401 beradi', async () => {
      const { service } = createService({ tenantBySubdomain: null });
      await expect(
        service.login({ subdomain: 'yoq', email: 'a@b.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("parol noto'g'ri bo'lsa 401 beradi", async () => {
      const user = makeUser({ id: 'u1', tenantId: 't1' });
      const { service } = createService({
        tenantBySubdomain: { id: 't1', subdomain: 'demo', name: 'Demo Hotel' },
        findByEmailAndTenantResult: user,
        validPasswordForUserIds: [], // hech kim uchun to'g'ri emas
      });
      await expect(
        service.login({
          subdomain: 'demo',
          email: user.email,
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login — subdomain berilmaganda (email orqali avtomatik aniqlash)', () => {
    it("email faqat bitta tenant'da mos kelsa, to'g'ridan-to'g'ri kiradi", async () => {
      const user = makeUser({
        id: 'u1',
        tenantId: 't1',
        email: 'staff@hotel.uz',
      });
      const { service } = createService({
        findAllByEmailResult: [user],
        validPasswordForUserIds: ['u1'],
        tenantsById: {
          t1: { id: 't1', subdomain: 'bukhara', name: 'Bukhara Hotel' },
        },
      });

      const res = await service.login({
        email: 'staff@hotel.uz',
        password: 'secret',
      });

      expect(res).toMatchObject({
        accessToken: 'signed-jwt',
        user: { id: 'u1', tenantSubdomain: 'bukhara' },
      });
    });

    it('hech qanday nomzod parolga mos kelmasa 401 beradi', async () => {
      const user1 = makeUser({
        id: 'u1',
        tenantId: 't1',
        email: 'staff@hotel.uz',
      });
      const user2 = makeUser({
        id: 'u2',
        tenantId: 't2',
        email: 'staff@hotel.uz',
      });
      const { service } = createService({
        findAllByEmailResult: [user1, user2],
        validPasswordForUserIds: [], // parol hech biriga mos emas
      });

      await expect(
        service.login({ email: 'staff@hotel.uz', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("bir xil email+parol 2 ta tenant'da ishласа, mehmonxona tanlashni so'raydi (token bermaydi)", async () => {
      const user1 = makeUser({
        id: 'u1',
        tenantId: 't1',
        email: 'dup@hotel.uz',
      });
      const user2 = makeUser({
        id: 'u2',
        tenantId: 't2',
        email: 'dup@hotel.uz',
      });
      const { service, jwtService } = createService({
        findAllByEmailResult: [user1, user2],
        validPasswordForUserIds: ['u1', 'u2'],
        tenantsById: {
          t1: { id: 't1', subdomain: 'bukhara', name: 'Bukhara Hotel' },
          t2: { id: 't2', subdomain: 'samarkand', name: 'Samarkand Hotel' },
        },
      });

      const res = await service.login({
        email: 'dup@hotel.uz',
        password: 'samepass',
      });

      expect(res).toEqual({
        requiresTenantSelection: true,
        tenants: [
          { subdomain: 'bukhara', name: 'Bukhara Hotel' },
          { subdomain: 'samarkand', name: 'Samarkand Hotel' },
        ],
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('platforma admin (tenantId=null) subdomainsiz kira oladi', async () => {
      const admin = makeUser({
        id: 'admin-1',
        tenantId: null,
        isPlatformAdmin: true,
        email: 'root@folioone.uz',
      });
      const { service } = createService({
        findAllByEmailResult: [admin],
        validPasswordForUserIds: ['admin-1'],
      });

      const res = await service.login({
        email: 'root@folioone.uz',
        password: 'rootpass',
      });

      expect(res).toMatchObject({
        accessToken: 'signed-jwt',
        user: {
          id: 'admin-1',
          tenantId: null,
          isPlatformAdmin: true,
          tenantSubdomain: null,
        },
      });
    });
  });

  // 🔴 2026-09-05 (audit): subdomainsiz yo'lda ham bir xil qoida — bloklangan
  // hisob mehmonxona tanlash ro'yxatida ham ko'rinmasligi kerak.
  describe('login — bloklangan hisob (subdomainsiz yo\'l)', () => {
    it('yagona nomzod bloklangan bo\'lsa 401 beradi', async () => {
      const user = makeUser({
        id: 'u1',
        tenantId: 't1',
        status: UserStatus.DISABLED,
      });
      const { service } = createService({
        findAllByEmailResult: [user],
        validPasswordForUserIds: ['u1'],
        tenantsById: { t1: { id: 't1', subdomain: 'demo', name: 'Demo' } },
      });

      await expect(
        service.login({ email: user.email, password: 'secret' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("ikkita nomzoddan biri bloklangan bo'lsa, faol hisobga to'g'ridan-to'g'ri kiritadi", async () => {
      const faol = makeUser({ id: 'u1', tenantId: 't1' });
      const blok = makeUser({
        id: 'u2',
        tenantId: 't2',
        email: faol.email,
        status: UserStatus.DISABLED,
      });
      const { service } = createService({
        findAllByEmailResult: [faol, blok],
        validPasswordForUserIds: ['u1', 'u2'],
        tenantsById: {
          t1: { id: 't1', subdomain: 'birinchi', name: 'Birinchi' },
          t2: { id: 't2', subdomain: 'ikkinchi', name: 'Ikkinchi' },
        },
      });

      const res = await service.login({ email: faol.email, password: 'secret' });
      // Tanlov ro'yxati EMAS — bitta faol hisob qolgani uchun to'g'ridan-to'g'ri token.
      expect(res).toMatchObject({
        accessToken: 'signed-jwt',
        user: { id: 'u1', tenantSubdomain: 'birinchi' },
      });
    });
  });
});
