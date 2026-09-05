import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AdminDemoRequestsController } from './admin-demo-requests.controller';
import { MarketingService } from './marketing.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

const JWT_SECRET = 'test-secret-admin-demo-requests-controller';

// Platforma super-admin uchun — PermissionsGuard emas, PlatformAdminGuard
// ishlatiladi (admin-billing/tenants bilan bir xil naqsh).
describe('AdminDemoRequestsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let marketingService: {
    listDemoRequests: jest.Mock;
    markContacted: jest.Mock;
  };

  beforeAll(async () => {
    marketingService = {
      listDemoRequests: jest.fn(),
      markContacted: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AdminDemoRequestsController],
      providers: [
        { provide: MarketingService, useValue: marketingService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider({ platformAdmins: ['u1'] }),
        JwtStrategy,
        JwtAuthGuard,
        PlatformAdminGuard,
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
      tenantId: null,
      isPlatformAdmin: true,
    },
  ) {
    return jwtService.sign(payload);
  }

  describe('GET /admin/demo-requests', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/admin/demo-requests')
        .expect(401);
      expect(marketingService.listDemoRequests).not.toHaveBeenCalled();
    });

    it("platforma admin bo'lmagan (oddiy tenant xodimi) 403 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/admin/demo-requests')
        .set(
          'Authorization',
          `Bearer ${tokenFor({ sub: 'u2', tenantId: 't1', isPlatformAdmin: false })}`,
        )
        .expect(403);
      expect(marketingService.listDemoRequests).not.toHaveBeenCalled();
    });

    it("platforma admin bo'lsa ro'yxatni qaytaradi", async () => {
      marketingService.listDemoRequests.mockResolvedValue({
        items: [{ id: '8b1a5f2c-3d4e-4a6b-9c8d-0e1f2a3b4c5d' }],
        total: 1,
        page: 1,
        pageSize: 50,
      });

      await request(app.getHttpServer())
        .get('/admin/demo-requests')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(marketingService.listDemoRequests).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe('PATCH /admin/demo-requests/:id/contacted', () => {
    it("platforma admin bo'lmasa 403 qaytaradi", async () => {
      await request(app.getHttpServer())
        .patch(
          '/admin/demo-requests/8b1a5f2c-3d4e-4a6b-9c8d-0e1f2a3b4c5d/contacted',
        )
        .set(
          'Authorization',
          `Bearer ${tokenFor({ sub: 'u2', tenantId: 't1', isPlatformAdmin: false })}`,
        )
        .send({ contacted: true })
        .expect(403);
      expect(marketingService.markContacted).not.toHaveBeenCalled();
    });

    it("platforma admin bo'lsa contacted holatini yangilaydi", async () => {
      marketingService.markContacted.mockResolvedValue({
        id: '8b1a5f2c-3d4e-4a6b-9c8d-0e1f2a3b4c5d',
        contacted: true,
      });

      await request(app.getHttpServer())
        .patch(
          '/admin/demo-requests/8b1a5f2c-3d4e-4a6b-9c8d-0e1f2a3b4c5d/contacted',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ contacted: true })
        .expect(200);

      expect(marketingService.markContacted).toHaveBeenCalledWith(
        '8b1a5f2c-3d4e-4a6b-9c8d-0e1f2a3b4c5d',
        true,
      );
    });
  });
});
