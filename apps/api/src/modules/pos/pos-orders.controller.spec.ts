import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PosOrdersController } from './pos-orders.controller';
import { PosOrdersService } from './pos-orders.service';
import { PosOutletsService } from './pos-outlets.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-pos-orders-controller';

describe('PosOrdersController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let posOrdersService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    addItems: jest.Mock;
    pay: jest.Mock;
    cancel: jest.Mock;
  };
  let posOutletsService: { findById: jest.Mock; getOrCreateDefault: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    posOrdersService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      addItems: jest.fn(),
      pay: jest.fn(),
      cancel: jest.fn(),
    };
    posOutletsService = {
      findById: jest.fn(),
      getOrCreateDefault: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PosOrdersController],
      providers: [
        { provide: PosOrdersService, useValue: posOrdersService },
        { provide: PosOutletsService, useValue: posOutletsService },
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

  describe('GET /properties/:propertyId/pos-orders', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/pos-orders')
        .expect(401);
      expect(posOrdersService.listByProperty).not.toHaveBeenCalled();
    });

    it("pos:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/pos-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(posOrdersService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa status filtri bilan qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      posOrdersService.listByProperty.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/pos-orders?status=open')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(posOrdersService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        'open',
      );
    });
  });

  describe('GET /properties/:propertyId/pos-orders/:id', () => {
    it("ruxsat bo'lsa buyurtmani qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      posOrdersService.findById.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .get('/properties/p1/pos-orders/po1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(posOrdersService.findById).toHaveBeenCalledWith('t1', 'p1', 'po1');
    });
  });

  describe('POST /properties/:propertyId/pos-orders', () => {
    it("pos:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ tableNumber: '5' })
        .expect(403);
      expect(posOrdersService.create).not.toHaveBeenCalled();
      expect(posOutletsService.getOrCreateDefault).not.toHaveBeenCalled();
    });

    it("outletId ko'rsatilmasa default outlet ishlatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:create']),
      );
      posOutletsService.getOrCreateDefault.mockResolvedValue({
        id: 'outlet-default',
      });
      posOrdersService.create.mockResolvedValue({ id: 'order-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ tableNumber: '5' })
        .expect(201);

      expect(posOutletsService.getOrCreateDefault).toHaveBeenCalledWith(
        't1',
        'p1',
      );
      expect(posOutletsService.findById).not.toHaveBeenCalled();
      expect(posOrdersService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'outlet-default',
        'u1',
        expect.objectContaining({ tableNumber: '5' }),
      );
    });

    it("outletId ko'rsatilsa o'sha outlet topib ishlatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:create']),
      );
      posOutletsService.findById.mockResolvedValue({ id: 'outlet-1' });
      posOrdersService.create.mockResolvedValue({ id: 'order-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ outletId: 'outlet-1', tableNumber: '5' })
        .expect(201);

      expect(posOutletsService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'outlet-1',
      );
      expect(posOutletsService.getOrCreateDefault).not.toHaveBeenCalled();
      expect(posOrdersService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'outlet-1',
        'u1',
        expect.objectContaining({ outletId: 'outlet-1' }),
      );
    });
  });

  describe('POST /properties/:propertyId/pos-orders/:id/items', () => {
    it("pos:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ items: [{ menuItemId: 'mi1', quantity: 2 }] })
        .expect(403);
      expect(posOrdersService.addItems).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa mahsulot qo'shadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:edit']),
      );
      posOrdersService.addItems.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ items: [{ menuItemId: 'mi1', quantity: 2 }] })
        .expect(201);

      expect(posOrdersService.addItems).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
        expect.objectContaining({
          items: [{ menuItemId: 'mi1', quantity: 2 }],
        }),
      );
    });
  });

  describe('POST /properties/:propertyId/pos-orders/:id/pay', () => {
    it("pos:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/pay')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ method: 'cash' })
        .expect(403);
      expect(posOrdersService.pay).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa to'lovni amalga oshiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:edit']),
      );
      posOrdersService.pay.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/pay')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ method: 'cash' })
        .expect(201);

      expect(posOrdersService.pay).toHaveBeenCalledWith(
        't1',
        'p1',
        'po1',
        expect.objectContaining({ method: 'cash' }),
      );
    });
  });

  describe('POST /properties/:propertyId/pos-orders/:id/cancel', () => {
    it("pos:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(posOrdersService.cancel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa buyurtmani bekor qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:edit']),
      );
      posOrdersService.cancel.mockResolvedValue({ id: 'po1' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-orders/po1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(posOrdersService.cancel).toHaveBeenCalledWith('t1', 'p1', 'po1');
    });
  });
});
