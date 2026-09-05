import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantStatus } from './entities/tenant.entity';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

const JWT_SECRET = 'test-secret-tenants-controller';

// `admin/tenants` — platforma super-admin uchun mo'ljallangan, oddiy tenant
// xodimi bu yerga umuman kira olmasligi kerak (PlatformAdminGuard). Bu eng
// yuqori imtiyozli endpointlardan biri (BARCHA tenant'larni ko'rish/holatini
// o'zgartirish) — shuning uchun guard zanjirini HTTP darajasida tekshirish
// ayniqsa muhim.
describe('TenantsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tenantsService: {
    listAll: jest.Mock;
    findById: jest.Mock;
    updateStatus: jest.Mock;
  };

  beforeAll(async () => {
    tenantsService = {
      listAll: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [TenantsController],
      providers: [
        { provide: TenantsService, useValue: tenantsService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider({ platformAdmins: ['admin-1'] }),
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

  function tokenFor(payload: {
    sub: string;
    tenantId: string | null;
    isPlatformAdmin: boolean;
  }) {
    return jwtService.sign(payload);
  }

  describe('GET /admin/tenants', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/admin/tenants').expect(401);
      expect(tenantsService.listAll).not.toHaveBeenCalled();
    });

    it("ODDIY (platforma admin bo'lmagan) tenant xodimi 403 oladi — cross-tenant hisob-faktura/tenant ma'lumotlariga kira olmaydi", async () => {
      const token = tokenFor({
        sub: 'owner-1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(tenantsService.listAll).not.toHaveBeenCalled();
    });

    it("platforma admin uchun 200 va barcha tenant ro'yxatini qaytaradi", async () => {
      tenantsService.listAll.mockResolvedValue([
        { id: 't1', name: 'Hotel A' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Hotel B' },
      ]);
      const token = tokenFor({
        sub: 'admin-1',
        tenantId: null,
        isPlatformAdmin: true,
      });
      const res = await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(tenantsService.listAll).toHaveBeenCalled();
    });
  });

  describe('PATCH /admin/tenants/:id/status', () => {
    it("ODDIY tenant xodimi (hatto o'z tenant'i ID'si bilan) boshqa tenant'ning holatini o'zgartira olmaydi — 403", async () => {
      const token = tokenFor({
        sub: 'owner-1',
        tenantId: 't1',
        isPlatformAdmin: false,
      });
      await request(app.getHttpServer())
        .patch('/admin/tenants/22222222-2222-4222-8222-222222222222/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TenantStatus.SUSPENDED })
        .expect(403);
      expect(tenantsService.updateStatus).not.toHaveBeenCalled();
    });

    it("platforma admin tenant holatini SUSPENDED ga o'zgartira oladi (masalan to'lov qilinmaganda)", async () => {
      tenantsService.updateStatus.mockResolvedValue({
        id: '22222222-2222-4222-8222-222222222222',
        status: TenantStatus.SUSPENDED,
      });
      const token = tokenFor({
        sub: 'admin-1',
        tenantId: null,
        isPlatformAdmin: true,
      });
      const res = await request(app.getHttpServer())
        .patch('/admin/tenants/22222222-2222-4222-8222-222222222222/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TenantStatus.SUSPENDED })
        .expect(200);

      expect(tenantsService.updateStatus).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
        TenantStatus.SUSPENDED,
      );
      expect(res.body).toEqual({ id: '22222222-2222-4222-8222-222222222222', status: TenantStatus.SUSPENDED });
    });
  });
});
