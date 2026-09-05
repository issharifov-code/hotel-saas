import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ACTIVE_AUTH_STATE } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const JWT_SECRET = 'test-secret-auth-controller';

// `AuthService` allaqachon batafsil (login rejimlari bo'yicha) sinovdan
// o'tgan — bu fayl esa CONTROLLER darajasini, ayniqsa `GET /auth/me`dagi
// yagona guard (JwtAuthGuard) haqiqatan ham ulanganini HTTP orqali
// tekshiradi (audit'ning "guard/permission ulanishi HTTP darajasida
// tekshirilmagan" degan High topilmasi).
describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authService: { registerTenant: jest.Mock; login: jest.Mock };
  let usersService: { findById: jest.Mock; revokeSessions: jest.Mock };
  let tenantsService: { findById: jest.Mock };

  beforeAll(async () => {
    authService = {
      registerTenant: jest.fn(),
      login: jest.fn(),
    };
    // `getAuthState` — `JwtStrategy` har so'rovda chaqiradigan token bekor
    // qilish tekshiruvi (2026-09-05). Bu yerda "mavjud, faol, hisoblagich 0"
    // holati beriladi; bekor qilishning o'zi jwt.strategy.spec.ts da.
    usersService = {
      findById: jest.fn(),
      revokeSessions: jest.fn().mockResolvedValue(undefined),
      getAuthState: jest.fn().mockResolvedValue(ACTIVE_AUTH_STATE),
    };
    tenantsService = { findById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: TenantsService, useValue: tenantsService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        JwtStrategy,
        JwtAuthGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register-tenant', () => {
    it('guardsiz ishlaydi va AuthService.registerTenant natijasini qaytaradi', async () => {
      authService.registerTenant.mockResolvedValue({
        accessToken: 'new-tenant-jwt',
        user: { id: 'owner-1', tenantId: 't1' },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register-tenant')
        .send({
          tenantName: 'Yangi Hotel',
          subdomain: 'yangi-hotel',
          ownerEmail: 'owner@example.com',
          ownerPassword: 'secret123',
          ownerFullName: 'Owner Name',
        })
        .expect(201);

      expect(res.body).toMatchObject({ accessToken: 'new-tenant-jwt' });
      expect(authService.registerTenant).toHaveBeenCalledWith(
        expect.objectContaining({ subdomain: 'yangi-hotel' }),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('guardsiz ishlaydi va AuthService.login natijasini qaytaradi', async () => {
      authService.login.mockResolvedValue({ accessToken: 'signed-jwt' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'secret' })
        .expect(201);

      expect(res.body).toEqual({ accessToken: 'signed-jwt' });
      expect(authService.login).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com' }),
      );
    });
  });

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, L9). Chiqish endi serverda ham
  // ta'sir qiladi — `token_version` oshiriladi.
  describe('POST /auth/logout', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
      expect(usersService.revokeSessions).not.toHaveBeenCalled();
    });

    it("to'g'ri token bilan sessiyalarni bekor qiladi va 204 qaytaradi", async () => {
      const token = jwtService.sign({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(usersService.revokeSessions).toHaveBeenCalledWith('u1');
    });
  });

  describe('GET /auth/me', () => {
    it("Authorization header bo'lmasa 401 qaytaradi (JwtAuthGuard ishlayapti)", async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it("noto'g'ri/buzilgan token bilan 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer yasama-token')
        .expect(401);
    });

    it("to'g'ri token bilan joriy foydalanuvchi + tenant ma'lumotini qaytaradi", async () => {
      usersService.findById.mockResolvedValue({
        id: 'u1',
        email: 'staff@hotel.uz',
        fullName: 'Xodim',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      tenantsService.findById.mockResolvedValue({
        id: 't1',
        subdomain: 'demo',
        hasSampleData: true,
      });

      const token = jwtService.sign({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(usersService.findById).toHaveBeenCalledWith('u1');
      expect(res.body).toMatchObject({
        id: 'u1',
        email: 'staff@hotel.uz',
        tenantSubdomain: 'demo',
        hasSampleData: true,
      });
    });

    it('platforma admin (tenantId=null) uchun tenant qidirmaydi, tenantSubdomain=null qaytaradi', async () => {
      usersService.findById.mockResolvedValue({
        id: 'admin-1',
        email: 'root@folioone.uz',
        fullName: 'Root Admin',
        tenantId: null,
        isPlatformAdmin: true,
      });

      const token = jwtService.sign({
        sub: 'admin-1',
        tenantId: null,
        isPlatformAdmin: true,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(tenantsService.findById).not.toHaveBeenCalled();
      expect(res.body).toMatchObject({
        id: 'admin-1',
        tenantId: null,
        tenantSubdomain: null,
        isPlatformAdmin: true,
      });
    });
  });
});
