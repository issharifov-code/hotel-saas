import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-payments-controller';

// To'lov qabul qilish — pul harakati bilan bog'liq eng xavfli endpoint
// (`charge`), lekin o'zining permission moduli yo'q — audit topilgan
// naqshga muvofiq `invoicing` modulidan foydalanadi. Bu HTTP darajasida
// aynan shu (invoicing:create) talab qilinishini tasdiqlaydi.
describe('PaymentsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let paymentsService: { listProviders: jest.Mock; chargeInvoice: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    paymentsService = {
      listProviders: jest.fn(),
      chargeInvoice: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
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

  describe('GET /properties/:propertyId/payment-providers', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/payment-providers')
        .expect(401);
      expect(paymentsService.listProviders).not.toHaveBeenCalled();
    });

    it("invoicing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/payment-providers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(paymentsService.listProviders).not.toHaveBeenCalled();
    });

    it("invoicing:view ruxsati bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      paymentsService.listProviders.mockResolvedValue(['mock']);

      await request(app.getHttpServer())
        .get('/properties/p1/payment-providers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(paymentsService.listProviders).toHaveBeenCalled();
    });
  });

  describe('POST /properties/:propertyId/invoices/:id/charge', () => {
    it("invoicing:create ruxsati yo'q bo'lsa 403 qaytaradi (invoicing:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/charge')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ amount: 100 })
        .expect(403);
      expect(paymentsService.chargeInvoice).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa hisob-fakturani tokendagi userId bilan to'lov qildiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:create']),
      );
      paymentsService.chargeInvoice.mockResolvedValue({
        id: 'inv1',
        status: 'paid',
      });

      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/charge')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ amount: 100, provider: 'mock' })
        .expect(201);

      expect(paymentsService.chargeInvoice).toHaveBeenCalledWith(
        't1',
        'p1',
        'inv1',
        expect.objectContaining({ amount: 100, provider: 'mock' }),
        'u1',
      );
    });
  });
});
