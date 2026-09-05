import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { WarehousesService } from './warehouses.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-purchase-orders-controller';

describe('PurchaseOrdersController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let purchaseOrdersService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
    cancel: jest.Mock;
    receive: jest.Mock;
  };
  let warehousesService: { getOrCreateDefault: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    purchaseOrdersService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      cancel: jest.fn(),
      receive: jest.fn(),
    };
    warehousesService = {
      getOrCreateDefault: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PurchaseOrdersController],
      providers: [
        { provide: PurchaseOrdersService, useValue: purchaseOrdersService },
        { provide: WarehousesService, useValue: warehousesService },
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

  describe('GET /properties/:propertyId/purchase-orders', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/purchase-orders')
        .expect(401);
      expect(purchaseOrdersService.listByProperty).not.toHaveBeenCalled();
    });

    it("warehouse:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/purchase-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(purchaseOrdersService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa status filtri bilan qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      purchaseOrdersService.listByProperty.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/purchase-orders?status=draft')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(purchaseOrdersService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        'draft',
      );
    });
  });

  describe('GET /properties/:propertyId/purchase-orders/:id', () => {
    it("ruxsat bo'lsa buyurtmani qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      purchaseOrdersService.findById.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .get('/properties/p1/purchase-orders/po1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(purchaseOrdersService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
      );
    });
  });

  describe('POST /properties/:propertyId/purchase-orders', () => {
    it("warehouse:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ supplierId: 'sup1' })
        .expect(403);
      expect(purchaseOrdersService.create).not.toHaveBeenCalled();
      expect(warehousesService.getOrCreateDefault).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa default omborni ishlatib buyurtma yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:create']),
      );
      warehousesService.getOrCreateDefault.mockResolvedValue({
        id: 'wh-default',
      });
      purchaseOrdersService.create.mockResolvedValue({ id: 'po-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ supplierId: 'sup1' })
        .expect(201);

      expect(warehousesService.getOrCreateDefault).toHaveBeenCalledWith(
        't1',
        'p1',
      );
      expect(purchaseOrdersService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'wh-default',
        'u1',
        expect.objectContaining({ supplierId: 'sup1' }),
      );
    });
  });

  describe('POST /properties/:propertyId/purchase-orders/:id/approve', () => {
    it("warehouse:approve ruxsati yo'q bo'lsa 403 qaytaradi (warehouse:edit yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:edit']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/approve')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(purchaseOrdersService.approve).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa buyurtmani tokendagi userId bilan tasdiqlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:approve']),
      );
      purchaseOrdersService.approve.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/approve')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(purchaseOrdersService.approve).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/purchase-orders/:id/reject', () => {
    it("warehouse:approve ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/reject')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(purchaseOrdersService.reject).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa buyurtmani rad etadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:approve']),
      );
      purchaseOrdersService.reject.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/reject')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(purchaseOrdersService.reject).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/purchase-orders/:id/cancel', () => {
    it("warehouse:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(purchaseOrdersService.cancel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa buyurtmani bekor qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:edit']),
      );
      purchaseOrdersService.cancel.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(purchaseOrdersService.cancel).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
      );
    });
  });

  describe('POST /properties/:propertyId/purchase-orders/:id/receive', () => {
    it("warehouse:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/receive')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ items: [{ purchaseOrderItemId: 'poi1', quantity: 5 }] })
        .expect(403);
      expect(purchaseOrdersService.receive).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa buyurtmani tokendagi userId bilan qabul qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:edit']),
      );
      purchaseOrdersService.receive.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/purchase-orders/po1/receive')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ items: [{ purchaseOrderItemId: 'poi1', quantity: 5 }] })
        .expect(201);

      expect(purchaseOrdersService.receive).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
        expect.objectContaining({
          items: [{ purchaseOrderItemId: 'poi1', quantity: 5 }],
        }),
        'u1',
      );
    });
  });
});
