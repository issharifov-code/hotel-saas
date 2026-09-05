import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { WarehouseStockController } from './warehouse-stock.controller';
import { WarehousesService } from './warehouses.service';
import { StockService } from './stock.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-warehouse-stock-controller';

describe('WarehouseStockController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let warehousesService: {
    listByProperty: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
  };
  let stockService: {
    getStockLevels: jest.Mock;
    listTransactions: jest.Mock;
    issue: jest.Mock;
    adjust: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    warehousesService = {
      listByProperty: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    stockService = {
      getStockLevels: jest.fn(),
      listTransactions: jest.fn(),
      issue: jest.fn(),
      adjust: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [WarehouseStockController],
      providers: [
        { provide: WarehousesService, useValue: warehousesService },
        { provide: StockService, useValue: stockService },
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

  describe('GET /properties/:propertyId/warehouses', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/warehouses')
        .expect(401);
      expect(warehousesService.listByProperty).not.toHaveBeenCalled();
    });

    it("warehouse:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/warehouses')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(warehousesService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      warehousesService.listByProperty.mockResolvedValue([{ id: 'wh1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/warehouses')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(warehousesService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('POST /properties/:propertyId/warehouses', () => {
    it("warehouse:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/warehouses')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Asosiy ombor' })
        .expect(403);
      expect(warehousesService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ombor yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:create']),
      );
      warehousesService.create.mockResolvedValue({ id: 'wh-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/warehouses')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Asosiy ombor' })
        .expect(201);

      expect(warehousesService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'Asosiy ombor',
      );
    });
  });

  describe('GET /properties/:propertyId/warehouses/:warehouseId/stock-levels', () => {
    it("warehouse:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/warehouses/wh1/stock-levels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(warehousesService.findById).not.toHaveBeenCalled();
      expect(stockService.getStockLevels).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa omborni tekshirib qoldiqlarni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      warehousesService.findById.mockResolvedValue({ id: 'wh1' });
      stockService.getStockLevels.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/warehouses/wh1/stock-levels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(warehousesService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'wh1',
      );
      expect(stockService.getStockLevels).toHaveBeenCalledWith('t1', 'wh1');
    });
  });

  describe('GET /properties/:propertyId/warehouses/:warehouseId/transactions', () => {
    it("ruxsat bo'lsa stockItemId filtri bilan qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      warehousesService.findById.mockResolvedValue({ id: 'wh1' });
      stockService.listTransactions.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/warehouses/wh1/transactions?stockItemId=si1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(stockService.listTransactions).toHaveBeenCalledWith(
        't1',
        'wh1',
        'si1',
      );
    });
  });

  describe('POST /properties/:propertyId/warehouses/:warehouseId/issue', () => {
    it("warehouse:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/warehouses/wh1/issue')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stockItemId: 'si1', quantity: 3 })
        .expect(403);
      expect(stockService.issue).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa omborni tekshirib tokendagi userId bilan chiqim qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:create']),
      );
      warehousesService.findById.mockResolvedValue({ id: 'wh1' });
      stockService.issue.mockResolvedValue({ id: 'tx1' });

      await request(app.getHttpServer())
        .post('/properties/p1/warehouses/wh1/issue')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stockItemId: 'si1', quantity: 3 })
        .expect(201);

      expect(warehousesService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'wh1',
      );
      expect(stockService.issue).toHaveBeenCalledWith(
        't1',
        'wh1',
        expect.objectContaining({ stockItemId: 'si1', quantity: 3 }),
        'u1',
        { propertyId: 'p1' },
      );
    });
  });

  describe('POST /properties/:propertyId/warehouses/:warehouseId/adjust', () => {
    it("warehouse:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/warehouses/wh1/adjust')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stockItemId: 'si1', quantity: -2, reason: 'Inventarizatsiya' })
        .expect(403);
      expect(stockService.adjust).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa omborni tekshirib tokendagi userId bilan tuzatadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:edit']),
      );
      warehousesService.findById.mockResolvedValue({ id: 'wh1' });
      stockService.adjust.mockResolvedValue({ id: 'tx1' });

      await request(app.getHttpServer())
        .post('/properties/p1/warehouses/wh1/adjust')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stockItemId: 'si1', quantity: -2, reason: 'Inventarizatsiya' })
        .expect(201);

      expect(stockService.adjust).toHaveBeenCalledWith(
        't1',
        'wh1',
        expect.objectContaining({ stockItemId: 'si1', quantity: -2 }),
        'u1',
        'p1',
      );
    });
  });
});
