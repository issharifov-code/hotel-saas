import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AdminBillingController } from './admin-billing.controller';
import { BillingService } from './billing.service';
import { SubscriptionInvoiceStatus } from './entities/subscription-invoice.entity';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

const JWT_SECRET = 'test-secret-admin-billing-controller';

// Platforma super-admin uchun (`PlatformAdminGuard`, tenant permission
// matritsasidan MUSTAQIL — `PermissionsGuard` ishlatilmaydi). Bu — barcha
// tenant'lar bo'yicha obuna hisob-fakturalarini ko'rish/yaratish/tasdiqlash
// imkoniyati bergani uchun eng yuqori imtiyozli endpointlardan biri: oddiy
// (hatto to'g'ri JWT bilan) tenant xodimi bu yerga umuman kira olmasligi
// HTTP darajasida tasdiqlanadi.
describe('AdminBillingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let billingService: {
    listAllInvoices: jest.Mock;
    getPlans: jest.Mock;
    generateInvoice: jest.Mock;
    markPaid: jest.Mock;
    cancelInvoice: jest.Mock;
  };

  beforeAll(async () => {
    billingService = {
      listAllInvoices: jest.fn(),
      getPlans: jest.fn(),
      generateInvoice: jest.fn(),
      markPaid: jest.fn(),
      cancelInvoice: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AdminBillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
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

  function tenantToken() {
    return jwtService.sign({
      sub: 'owner-1',
      tenantId: 't1',
      isPlatformAdmin: false,
    });
  }

  function adminToken() {
    return jwtService.sign({
      sub: 'admin-1',
      tenantId: null,
      isPlatformAdmin: true,
    });
  }

  describe('GET /admin/billing/invoices', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/admin/billing/invoices')
        .expect(401);
      expect(billingService.listAllInvoices).not.toHaveBeenCalled();
    });

    it("ODDIY tenant xodimi (to'g'ri JWT bilan ham) 403 oladi", async () => {
      await request(app.getHttpServer())
        .get('/admin/billing/invoices')
        .set('Authorization', `Bearer ${tenantToken()}`)
        .expect(403);
      expect(billingService.listAllInvoices).not.toHaveBeenCalled();
    });

    it("platforma admin uchun 200 va filtr query'lari servisga uzatiladi", async () => {
      billingService.listAllInvoices.mockResolvedValue([{ id: 'inv1' }]);

      await request(app.getHttpServer())
        .get('/admin/billing/invoices?tenantId=t2&status=pending')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(billingService.listAllInvoices).toHaveBeenCalledWith({
        tenantId: 't2',
        status: 'pending',
      });
    });
  });

  describe('POST /admin/billing/tenants/:tenantId/invoices', () => {
    it('ODDIY tenant xodimi 403 oladi — boshqa tenant uchun hisob-faktura yarata olmaydi', async () => {
      await request(app.getHttpServer())
        .post('/admin/billing/tenants/t2/invoices')
        .set('Authorization', `Bearer ${tenantToken()}`)
        .send({ periodStart: '2026-09-01', periodEnd: '2026-09-30' })
        .expect(403);
      expect(billingService.generateInvoice).not.toHaveBeenCalled();
    });

    it("platforma admin URL'dagi tenantId uchun hisob-faktura yaratadi", async () => {
      billingService.generateInvoice.mockResolvedValue({ id: 'inv-new' });

      await request(app.getHttpServer())
        .post('/admin/billing/tenants/t2/invoices')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ periodStart: '2026-09-01', periodEnd: '2026-09-30' })
        .expect(201);

      expect(billingService.generateInvoice).toHaveBeenCalledWith(
        't2',
        expect.objectContaining({ periodStart: '2026-09-01' }),
      );
    });
  });

  describe('POST /admin/billing/invoices/:id/mark-paid', () => {
    it('ODDIY tenant xodimi 403 oladi', async () => {
      await request(app.getHttpServer())
        .post('/admin/billing/invoices/inv1/mark-paid')
        .set('Authorization', `Bearer ${tenantToken()}`)
        .expect(403);
      expect(billingService.markPaid).not.toHaveBeenCalled();
    });

    it("platforma admin hisob-fakturani tokendagi userId bilan to'langan deb belgilaydi", async () => {
      billingService.markPaid.mockResolvedValue({
        id: 'inv1',
        status: SubscriptionInvoiceStatus.PAID,
      });

      await request(app.getHttpServer())
        .post('/admin/billing/invoices/inv1/mark-paid')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(201);

      expect(billingService.markPaid).toHaveBeenCalledWith('inv1', 'admin-1');
    });
  });

  describe('POST /admin/billing/invoices/:id/cancel', () => {
    it('ODDIY tenant xodimi 403 oladi', async () => {
      await request(app.getHttpServer())
        .post('/admin/billing/invoices/inv1/cancel')
        .set('Authorization', `Bearer ${tenantToken()}`)
        .expect(403);
      expect(billingService.cancelInvoice).not.toHaveBeenCalled();
    });

    it('platforma admin hisob-fakturani bekor qiladi', async () => {
      billingService.cancelInvoice.mockResolvedValue({
        id: 'inv1',
        status: SubscriptionInvoiceStatus.CANCELLED,
      });

      await request(app.getHttpServer())
        .post('/admin/billing/invoices/inv1/cancel')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(201);

      expect(billingService.cancelInvoice).toHaveBeenCalledWith('inv1');
    });
  });

  describe('GET /admin/billing/plans', () => {
    it('platforma admin uchun 200 qaytaradi', async () => {
      billingService.getPlans.mockResolvedValue([{ id: 'pro' }]);

      await request(app.getHttpServer())
        .get('/admin/billing/plans')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(billingService.getPlans).toHaveBeenCalled();
    });
  });
});
