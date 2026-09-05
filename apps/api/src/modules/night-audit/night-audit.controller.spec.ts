import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-night-audit-controller';

// Night Audit ("kunni yopish") — alohida PermissionModule yo'q, mavjud
// FRONT_DESK moduli qayta ishlatiladi (check-in/check-out oilasidan).
describe('NightAuditController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let nightAuditService: {
    getStatus: jest.Mock;
    history: jest.Mock;
    run: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    nightAuditService = {
      getStatus: jest.fn(),
      history: jest.fn(),
      run: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [NightAuditController],
      providers: [
        { provide: NightAuditService, useValue: nightAuditService },
        { provide: RolesService, useValue: rolesService },
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

  describe('GET /properties/:propertyId/night-audit/status', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/night-audit/status')
        .expect(401);
      expect(nightAuditService.getStatus).not.toHaveBeenCalled();
    });

    it("front_desk:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/night-audit/status')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(nightAuditService.getStatus).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa holatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:view']),
      );
      nightAuditService.getStatus.mockResolvedValue({
        businessDate: '2026-09-02',
      });

      await request(app.getHttpServer())
        .get('/properties/p1/night-audit/status')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(nightAuditService.getStatus).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/night-audit/history', () => {
    it("ruxsat bo'lsa standart pageSize (30) bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:view']),
      );
      nightAuditService.history.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 30,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/night-audit/history')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(nightAuditService.history).toHaveBeenCalledWith('t1', 'p1', {
        page: 1,
        pageSize: 30,
        skip: 0,
        take: 30,
      });
    });

    it("aniq page/pageSize bilan chaqirilganda to'g'ri uzatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:view']),
      );
      nightAuditService.history.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/night-audit/history?page=2&pageSize=10')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(nightAuditService.history).toHaveBeenCalledWith('t1', 'p1', {
        page: 2,
        pageSize: 10,
        skip: 10,
        take: 10,
      });
    });
  });

  describe('POST /properties/:propertyId/night-audit/run', () => {
    it("front_desk:approve ruxsati yo'q bo'lsa 403 qaytaradi (front_desk:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/night-audit/run')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(nightAuditService.run).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa kunni tokendagi userId bilan yopadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:approve']),
      );
      nightAuditService.run.mockResolvedValue({ businessDate: '2026-09-03' });

      await request(app.getHttpServer())
        .post('/properties/p1/night-audit/run')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(nightAuditService.run).toHaveBeenCalledWith('t1', 'p1', 'u1');
    });
  });
});
