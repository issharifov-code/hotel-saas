import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-billing-controller';

// Tenant tomoni — faqat o'qish (`billing:view`), yozish/o'zgartirish yo'q.
// `propertyId` URL'da umuman yo'q (`@Controller('billing')`, property-ostida
// emas) — shuning uchun PermissionsGuard propertyId'ni `undefined` sifatida
// uzatadi, bu HTTP darajasida tekshiriladi.
describe('BillingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let billingService: {
    getMySubscription: jest.Mock;
    listInvoicesForTenant: jest.Mock;
    getPlans: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    billingService = {
      getMySubscription: jest.fn(),
      listInvoicesForTenant: jest.fn(),
      getPlans: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
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

  describe('GET /billing/subscription', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/billing/subscription')
        .expect(401);
      expect(billingService.getMySubscription).not.toHaveBeenCalled();
    });

    it("billing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(billingService.getMySubscription).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa joriy tenant obunasini qaytaradi (propertyId'siz chaqiriladi)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['billing:view']),
      );
      billingService.getMySubscription.mockResolvedValue({ plan: 'pro' });

      await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        undefined,
      );
      expect(billingService.getMySubscription).toHaveBeenCalledWith('t1');
    });
  });

  describe('GET /billing/invoices', () => {
    it("billing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/billing/invoices')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(billingService.listInvoicesForTenant).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa joriy tenant hisob-fakturalarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['billing:view']),
      );
      billingService.listInvoicesForTenant.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/billing/invoices')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(billingService.listInvoicesForTenant).toHaveBeenCalledWith('t1');
    });
  });

  describe('GET /billing/plans', () => {
    it("billing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/billing/plans')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(billingService.getPlans).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa reja ro'yxatini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['billing:view']),
      );
      billingService.getPlans.mockResolvedValue([{ id: 'pro' }]);

      await request(app.getHttpServer())
        .get('/billing/plans')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(billingService.getPlans).toHaveBeenCalled();
    });
  });
});
