import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

const JWT_SECRET = 'test-secret-roles-controller';

// Xavfsizlik nuqtai nazaridan muhim controller: rol/ruxsat boshqaruvi.
// `GET /roles` uchun `users_roles:view` talabi shu sessiyaning oldingi
// bosqichida qo'shilgan tuzatish edi (avval hech qanday @RequirePermission
// yo'q edi) — bu test aynan shu tuzatishni HTTP darajasida tasdiqlaydi.
// `GET /permissions` va `GET /me/permissions` esa faqat JWT talab qiladi,
// qo'shimcha ruxsat tekshiruvisiz.
describe('RolesController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let rolesService: {
    getEffectivePermissions: jest.Mock;
    listRolesForTenant: jest.Mock;
    createCustomRole: jest.Mock;
    updateRolePermissions: jest.Mock;
    listUserRoleAssignments: jest.Mock;
    assignRoleToUser: jest.Mock;
    removeRoleFromUser: jest.Mock;
  };
  let permissionsService: { findAll: jest.Mock };

  beforeAll(async () => {
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      listRolesForTenant: jest.fn(),
      createCustomRole: jest.fn(),
      updateRolePermissions: jest.fn(),
      listUserRoleAssignments: jest.fn(),
      assignRoleToUser: jest.fn(),
      removeRoleFromUser: jest.fn(),
    };
    permissionsService = {
      findAll: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [RolesController],
      providers: [
        { provide: RolesService, useValue: rolesService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider(),
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

  function tokenFor(
    payload: {
      sub: string;
      tenantId: string | null;
      isPlatformAdmin: boolean;
    } = {
      sub: 'u1',
      tenantId: 't1',
      isPlatformAdmin: false,
    },
  ) {
    return jwtService.sign(payload);
  }

  describe('GET /permissions', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/permissions').expect(401);
      expect(permissionsService.findAll).not.toHaveBeenCalled();
    });

    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low). Ilgari bu yo'l HECH QANDAY
    // ruxsat talab qilmasdi: istalgan tizimga kirgan xodim (POS ofitsianti
    // ham) barcha ruxsat UUID'larini olardi — aynan `POST /roles` uchun
    // kerak bo'ladigan ro'yxatni. Rol eskalatsiyasining birinchi qadami edi.
    it("users_roles:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());

      await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);

      expect(permissionsService.findAll).not.toHaveBeenCalled();
    });

    it("users_roles:view ruxsati bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:view']),
      );
      permissionsService.findAll.mockResolvedValue([
        { id: 'perm1', module: 'booking', action: 'view' },
      ]);

      await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(permissionsService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /roles', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/roles').expect(401);
      expect(rolesService.listRolesForTenant).not.toHaveBeenCalled();
    });

    it("users_roles:view ruxsati yo'q bo'lsa 403 qaytaradi (avvalgi tuzatish tasdiqlanadi)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(rolesService.listRolesForTenant).not.toHaveBeenCalled();
    });

    it("users_roles:view ruxsati bo'lsa 200 va joriy tenant rollarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:view']),
      );
      rolesService.listRolesForTenant.mockResolvedValue([{ id: 'role1' }]);

      await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.listRolesForTenant).toHaveBeenCalledWith('t1');
    });
  });

  describe('POST /roles', () => {
    it("users_roles:create ruxsati yo'q bo'lsa 403 qaytaradi (users_roles:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:view']),
      );
      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Qabul xodimi', permissionIds: ['p1'] })
        .expect(403);
      expect(rolesService.createCustomRole).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa joriy tenant ostida yangi rol yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:create']),
      );
      rolesService.createCustomRole.mockResolvedValue({ id: 'role-new' });

      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Qabul xodimi', permissionIds: ['p1'] })
        .expect(201);

      // `u1` — chaqiruvchi: "o'zingda yo'q ruxsatni bera olmaysan"
      // tekshiruvi uchun servisga uzatiladi (2026-09-05 auditi).
      expect(rolesService.createCustomRole).toHaveBeenCalledWith(
        't1',
        'u1',
        'Qabul xodimi',
        ['p1'],
      );
    });
  });

  describe('PATCH /roles/:id/permissions', () => {
    it("users_roles:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/roles/33333333-3333-4333-8333-333333333333/permissions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ permissionIds: ['p1', 'p2'] })
        .expect(403);
      expect(rolesService.updateRolePermissions).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa rol ruxsatlarini yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      rolesService.updateRolePermissions.mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' });

      await request(app.getHttpServer())
        .patch('/roles/33333333-3333-4333-8333-333333333333/permissions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ permissionIds: ['p1', 'p2'] })
        .expect(200);

      expect(rolesService.updateRolePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        '33333333-3333-4333-8333-333333333333',
        ['p1', 'p2'],
      );
    });
  });

  describe('GET /user-roles', () => {
    it("users_roles:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/user-roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(rolesService.listUserRoleAssignments).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa joriy tenant tayinlovlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:view']),
      );
      rolesService.listUserRoleAssignments.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/user-roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.listUserRoleAssignments).toHaveBeenCalledWith('t1');
    });
  });

  describe('POST /user-roles', () => {
    it("users_roles:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/user-roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ userId: 'u2', roleId: 'role1', propertyId: 'p1' })
        .expect(403);
      expect(rolesService.assignRoleToUser).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa rolni foydalanuvchiga joriy tenant ostida tayinlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      rolesService.assignRoleToUser.mockResolvedValue({ id: 'ur1' });

      await request(app.getHttpServer())
        .post('/user-roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ userId: 'u2', roleId: 'role1', propertyId: 'p1' })
        .expect(201);

      expect(rolesService.assignRoleToUser).toHaveBeenCalledWith(
        't1',
        'u2',
        'role1',
        'p1',
        // Chaqiruvchi — eskalatsiya tekshiruvlari uchun (2026-09-05 auditi).
        'u1',
      );
    });

    it('propertyId berilmasa null sifatida uzatiladi (tenant darajasidagi tayinlov)', async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      rolesService.assignRoleToUser.mockResolvedValue({ id: 'ur1' });

      await request(app.getHttpServer())
        .post('/user-roles')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ userId: 'u2', roleId: 'role1' })
        .expect(201);

      expect(rolesService.assignRoleToUser).toHaveBeenCalledWith(
        't1',
        'u2',
        'role1',
        null,
        'u1',
      );
    });
  });

  describe('DELETE /user-roles/:userId/:roleId', () => {
    it("users_roles:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .delete('/user-roles/u2/role1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(rolesService.removeRoleFromUser).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa tayinlovni olib tashlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['users_roles:edit']),
      );
      rolesService.removeRoleFromUser.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/user-roles/u2/role1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.removeRoleFromUser).toHaveBeenCalledWith(
        't1',
        'u2',
        'role1',
      );
    });
  });

  describe('GET /me/permissions', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/me/permissions').expect(401);
    });

    it("qo'shimcha @RequirePermission talab qilmaydi — faqat JWT bilan o'z ruxsatlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view', 'front_desk:approve']),
      );

      const res = await request(app.getHttpServer())
        .get('/me/permissions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
      );
      const body = res.body as string[];
      expect(body.sort()).toEqual(
        ['booking:view', 'front_desk:approve'].sort(),
      );
    });

    it("tenantId yo'q (masalan platforma admin) bo'lsa bo'sh ro'yxat qaytaradi, servis chaqirilmaydi", async () => {
      const res = await request(app.getHttpServer())
        .get('/me/permissions')
        .set(
          'Authorization',
          `Bearer ${tokenFor({ sub: 'admin1', tenantId: null, isPlatformAdmin: true })}`,
        )
        .expect(200);

      expect(rolesService.getEffectivePermissions).not.toHaveBeenCalled();
      expect(res.body).toEqual([]);
    });
  });
});
