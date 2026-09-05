import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { StockItemsController } from './stock-items.controller';
import { StockItemsService } from './stock-items.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-stock-items-controller';

describe('StockItemsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let stockItemsService: { list: jest.Mock; create: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    stockItemsService = {
      list: jest.fn(),
      create: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [StockItemsController],
      providers: [
        { provide: StockItemsService, useValue: stockItemsService },
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

  describe('GET /stock-items', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/stock-items').expect(401);
      expect(stockItemsService.list).not.toHaveBeenCalled();
    });

    it("warehouse:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/stock-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(stockItemsService.list).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa activeOnly=true bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      stockItemsService.list.mockResolvedValue([{ id: 'si1' }]);

      await request(app.getHttpServer())
        .get('/stock-items?activeOnly=true')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(stockItemsService.list).toHaveBeenCalledWith('t1', true);
    });

    it("activeOnly ko'rsatilmasa false bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      stockItemsService.list.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/stock-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(stockItemsService.list).toHaveBeenCalledWith('t1', false);
    });
  });

  describe('POST /stock-items', () => {
    it("warehouse:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/stock-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Sochiq', unit: 'dona' })
        .expect(403);
      expect(stockItemsService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ombor elementini yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:create']),
      );
      stockItemsService.create.mockResolvedValue({ id: 'si-new' });

      await request(app.getHttpServer())
        .post('/stock-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Sochiq', unit: 'dona' })
        .expect(201);

      expect(stockItemsService.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'Sochiq' }),
      );
    });
  });
});
