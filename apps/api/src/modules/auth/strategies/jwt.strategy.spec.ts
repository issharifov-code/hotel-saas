import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserStatus } from '../../users/entities/user.entity';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

// 🔴 Token bekor qilish (2026-09-05, kod auditining oxirgi ochiq topilmasi).
//
// Avval `validate` faqat imzoni tekshirardi va payload'ni qaytarardi —
// ya'ni bloklangan xodimning tokeni muddati tugagunicha (8 soat)
// ishlayverardi. Bu yerdagi testlar aynan shu darvozani qo'riqlaydi.
describe('JwtStrategy.validate', () => {
  const configService = { get: () => 'test-secret' };

  function createStrategy(
    authState: { status: UserStatus; tokenVersion: number } | null,
  ) {
    const usersService = {
      getAuthState: jest.fn().mockResolvedValue(authState),
    };
    const strategy = new JwtStrategy(
      configService as never,
      usersService as never,
    );
    return { strategy, usersService };
  }

  function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
    return {
      sub: 'u1',
      tenantId: 't1',
      isPlatformAdmin: false,
      ...overrides,
    };
  }

  it("mos hisoblagich bilan foydalanuvchini qaytaradi", async () => {
    const { strategy } = createStrategy({
      status: UserStatus.ACTIVE,
      tokenVersion: 2,
    });
    await expect(strategy.validate(payload({ tv: 2 }))).resolves.toEqual({
      userId: 'u1',
      tenantId: 't1',
      isPlatformAdmin: false,
    });
  });

  // Bu o'zgarish joriy qilingan paytda amal qilayotgan tokenlarda `tv`
  // maydoni umuman yo'q. Ular hisoblagich hali 0 bo'lgan foydalanuvchilar
  // uchun ishlayverishi kerak — aks holda deploy hammani tizimdan
  // chiqarib yuborardi.
  it("eski token (tv yo'q) hisoblagich 0 bo'lsa ishlaydi", async () => {
    const { strategy } = createStrategy({
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    });
    await expect(strategy.validate(payload())).resolves.toMatchObject({
      userId: 'u1',
    });
  });

  it("eski token (tv yo'q) hisoblagich oshgan bo'lsa rad etiladi", async () => {
    const { strategy } = createStrategy({
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
    });
    await expect(strategy.validate(payload())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("hisoblagich oshgan bo'lsa (parol almashtirilgan) rad etiladi", async () => {
    const { strategy } = createStrategy({
      status: UserStatus.ACTIVE,
      tokenVersion: 5,
    });
    await expect(strategy.validate(payload({ tv: 4 }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('bloklangan xodimning tokeni darhol rad etiladi', async () => {
    const { strategy } = createStrategy({
      status: UserStatus.DISABLED,
      tokenVersion: 0,
    });
    await expect(strategy.validate(payload({ tv: 0 }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("hali faollashtirilmagan (INVITED) xodim ham rad etiladi", async () => {
    const { strategy } = createStrategy({
      status: UserStatus.INVITED,
      tokenVersion: 0,
    });
    await expect(strategy.validate(payload({ tv: 0 }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("foydalanuvchi o'chirilgan bo'lsa rad etiladi", async () => {
    const { strategy } = createStrategy(null);
    await expect(strategy.validate(payload({ tv: 0 }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('tekshiruvni tokendagi sub bo\'yicha qiladi', async () => {
    const { strategy, usersService } = createStrategy({
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    });
    await strategy.validate(payload({ sub: 'boshqa-user', tv: 0 }));
    expect(usersService.getAuthState).toHaveBeenCalledWith('boshqa-user');
  });
});
