import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-invoicing-controller';

// Pul bilan bog'liq controller — `invoicing:view/create/edit` uch xil
// action ostida turli endpointlarni himoyalaydi. HTTP darajasidagi test
// har bir action to'g'ri talab qilinayotganini va sahifalash (pagination)
// parametrlari servisga to'g'ri uzatilishini tekshiradi.
describe('InvoicingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let invoicingService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    findByBooking: jest.Mock;
    addLine: jest.Mock;
    addPayment: jest.Mock;
    cancel: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    invoicingService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      findByBooking: jest.fn(),
      addLine: jest.fn(),
      addPayment: jest.fn(),
      cancel: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [InvoicingController],
      providers: [
        { provide: InvoicingService, useValue: invoicingService },
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

  describe('GET /properties/:propertyId/invoices', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/invoices')
        .expect(401);
      expect(invoicingService.listByProperty).not.toHaveBeenCalled();
    });

    it("invoicing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/invoices')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(invoicingService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 va page/pageSize query'lari ajratilgan holda servisga uzatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      invoicingService.listByProperty.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/invoices?page=2&pageSize=10&status=paid')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        'p1',
      );
      expect(invoicingService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        'paid',
        { page: 2, pageSize: 10, skip: 10, take: 10 },
      );
    });

    it("page/pageSize berilmasa standart qiymatlar (page=1, pageSize=25) qo'llanadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      invoicingService.listByProperty.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/invoices')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(invoicingService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        undefined,
        { page: 1, pageSize: 25, skip: 0, take: 25 },
      );
    });
  });

  describe('GET /properties/:propertyId/invoices/:id', () => {
    it("invoicing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/invoices/inv1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(invoicingService.findById).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      invoicingService.findById.mockResolvedValue({ id: 'inv1' });

      await request(app.getHttpServer())
        .get('/properties/p1/invoices/inv1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(invoicingService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'inv1',
      );
    });
  });

  describe('GET /properties/:propertyId/bookings/:bookingId/invoice', () => {
    it("ruxsat bo'lsa bron bo'yicha hisob-fakturani qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      invoicingService.findByBooking.mockResolvedValue({ id: 'inv1' });

      await request(app.getHttpServer())
        .get('/properties/p1/bookings/b1/invoice')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(invoicingService.findByBooking).toHaveBeenCalledWith(
        't1',
        'p1',
        'b1',
      );
    });
  });

  describe('POST /properties/:propertyId/invoices/:id/lines', () => {
    it("invoicing:create ruxsati yo'q bo'lsa 403 qaytaradi (invoicing:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/lines')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ description: 'Minibar', amount: '15.00' })
        .expect(403);
      expect(invoicingService.addLine).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa qatorni qo'shadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:create']),
      );
      invoicingService.addLine.mockResolvedValue({ id: 'inv1' });

      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/lines')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ description: 'Minibar', amount: '15.00' })
        .expect(201);

      expect(invoicingService.addLine).toHaveBeenCalledWith(
        't1',
        'p1',
        'inv1',
        expect.objectContaining({ description: 'Minibar' }),
      );
    });
  });

  describe('POST /properties/:propertyId/invoices/:id/payments', () => {
    it("invoicing:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/payments')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ amount: '50.00', method: 'cash' })
        .expect(403);
      expect(invoicingService.addPayment).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa to'lovni tokendagi userId bilan qo'shadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:create']),
      );
      invoicingService.addPayment.mockResolvedValue({ id: 'inv1' });

      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/payments')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ amount: '50.00', method: 'cash' })
        .expect(201);

      expect(invoicingService.addPayment).toHaveBeenCalledWith(
        't1',
        'p1',
        'inv1',
        expect.objectContaining({ amount: '50.00' }),
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/invoices/:id/cancel', () => {
    it("invoicing:edit ruxsati yo'q bo'lsa 403 qaytaradi (invoicing:create yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:create']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(invoicingService.cancel).not.toHaveBeenCalled();
    });

    it("invoicing:edit ruxsati bo'lsa hisob-fakturani bekor qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:edit']),
      );
      invoicingService.cancel.mockResolvedValue({
        id: 'inv1',
        status: 'cancelled',
      });

      await request(app.getHttpServer())
        .post('/properties/p1/invoices/inv1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(invoicingService.cancel).toHaveBeenCalledWith('t1', 'p1', 'inv1');
    });
  });
});
