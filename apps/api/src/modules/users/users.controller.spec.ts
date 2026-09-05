import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserStatus } from './entities/user.entity';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { ACTIVE_AUTH_STATE } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-users-controller';

// Bu controller `@UseGuards(JwtAuthGuard, PermissionsGuard)` + har bir
// endpointda `@RequirePermission(...)` bilan himoyalangan. Sinov HAQIQIY
// guard zanjirini HTTP orqali ko'taradi — maqsad aynan shu turdagi
// kamchilikni ushlash: audit `roles.controller.ts`da `@RequirePermission`
// yo'qligini topgan edi (2026-09-01'da tuzatildi), lekin buni faqat
// HTTP-darajasidagi test kafolatlay oladi — service-spec buni sinamaydi,
// chunki dekorator controller metadatasida, service kodida emas.
describe('UsersController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let usersService: {
    listByTenant: jest.Mock;
    createUser: jest.Mock;
    resetPassword: jest.Mock;
    updateStatus: jest.Mock;
    getAuthState: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    usersService = {
      listByTenant: jest.fn(),
      createUser: jest.fn(),
      resetPassword: jest.fn(),
      updateStatus: jest.fn(),
      // `JwtStrategy` har so'rovda chaqiradigan token bekor qilish
      // tekshiruvi (2026-09-05) — bu yerda "mavjud, faol, hisoblagich 0".
      getAuthState: jest.fn().mockResolvedValue(ACTIVE_AUTH_STATE),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
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

  function tokenFor(payload: {
    sub: string;
    tenantId: string | null;
    isPlatformAdmin: boolean;
  }) {
    return jwtService.sign(payload);
  }

  describe('GET /users', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
      expect(usersService.listByTenant).not.toHaveBeenCalled();
    });

    it("token to'g'ri, lekin users_roles:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      const token = tokenFor({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(usersService.listByTenant).not.toHaveBeenCalled();
    });

    it("users_roles:view ruxsati bo'lsa 200 va joriy tenant xodimlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:view']),
      );
      usersService.listByTenant.mockResolvedValue([
        {
          id: 'emp-1',
          email: 'a@b.com',
          fullName: 'Ali',
          status: UserStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
        },
      ]);
      const token = tokenFor({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(usersService.listByTenant).toHaveBeenCalledWith('t1');
      expect(res.body).toEqual([
        expect.objectContaining({ id: 'emp-1', email: 'a@b.com' }),
      ]);
    });
  });

  describe('POST /users', () => {
    it("users_roles:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      const token = tokenFor({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'yangi@b.com',
          password: 'secret123',
          fullName: 'Yangi',
        })
        .expect(403);
      expect(usersService.createUser).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangi xodimni joriy foydalanuvchining tenant'ida yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:create']),
      );
      usersService.createUser.mockResolvedValue({
        id: 'new-1',
        email: 'yangi@b.com',
        fullName: 'Yangi',
        status: UserStatus.ACTIVE,
      });
      const token = tokenFor({
        sub: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'yangi@b.com',
          password: 'secret123',
          fullName: 'Yangi',
        })
        .expect(201);

      // tenantId so'rov tanasidan emas, autentifikatsiyalangan foydalanuvchidan
      // olinishi shart — client boshqa tenant'ga xodim "yozib qo'ya olmasligi" kerak.
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', email: 'yangi@b.com' }),
      );
    });
  });

  describe('PATCH /users/:id/status', () => {
    it("o'zining holatini o'zgartirishga urinsa 403 qaytaradi (ruxsat bor bo'lsa ham)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      const token = tokenFor({
        sub: 'self-1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .patch('/users/self-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: UserStatus.DISABLED })
        .expect(403);
      expect(usersService.updateStatus).not.toHaveBeenCalled();
    });

    it("boshqa xodim uchun ruxsat bo'lsa holatni yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      usersService.updateStatus.mockResolvedValue({
        id: 'other-1',
        status: UserStatus.DISABLED,
      });
      const token = tokenFor({
        sub: 'admin-1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      const res = await request(app.getHttpServer())
        .patch('/users/other-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: UserStatus.DISABLED })
        .expect(200);

      expect(usersService.updateStatus).toHaveBeenCalledWith(
        't1',
        'other-1',
        UserStatus.DISABLED,
      );
      expect(res.body).toEqual({ id: 'other-1', status: UserStatus.DISABLED });
    });

    it("users_roles:edit ruxsati yo'q bo'lsa 403 qaytaradi (o'z-o'zini tekshirishdan OLDIN)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      const token = tokenFor({
        sub: 'admin-1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .patch('/users/other-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: UserStatus.DISABLED })
        .expect(403);
      expect(usersService.updateStatus).not.toHaveBeenCalled();
    });
  });
});
