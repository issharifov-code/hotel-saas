import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { MenuItemsController } from './menu-items.controller';
import { MenuItemsService } from './menu-items.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-menu-items-controller';

// MenuItemsController — boshqa POS controller'lardan farqli, marshruti
// property-scoped emas ('menu-items', propertyId yo'q), lekin bir xil POS
// PermissionModule ostida (menyu tenant darajasida umumiy).
describe('MenuItemsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let menuItemsService: { list: jest.Mock; create: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    menuItemsService = {
      list: jest.fn(),
      create: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [MenuItemsController],
      providers: [
        { provide: MenuItemsService, useValue: menuItemsService },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
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

  describe('GET /menu-items', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/menu-items').expect(401);
      expect(menuItemsService.list).not.toHaveBeenCalled();
    });

    it("pos:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/menu-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(menuItemsService.list).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa activeOnly=true bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      menuItemsService.list.mockResolvedValue([{ id: 'mi1' }]);

      await request(app.getHttpServer())
        .get('/menu-items?activeOnly=true')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(menuItemsService.list).toHaveBeenCalledWith('t1', true);
    });

    it("activeOnly ko'rsatilmasa false bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      menuItemsService.list.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/menu-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(menuItemsService.list).toHaveBeenCalledWith('t1', false);
    });
  });

  describe('POST /menu-items', () => {
    it("pos:create ruxsati yo'q bo'lsa 403 qaytaradi (pos:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      await request(app.getHttpServer())
        .post('/menu-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Osh', price: 25000 })
        .expect(403);
      expect(menuItemsService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa menyu elementini yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:create']),
      );
      menuItemsService.create.mockResolvedValue({ id: 'mi-new' });

      await request(app.getHttpServer())
        .post('/menu-items')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Osh', price: 25000 })
        .expect(201);

      expect(menuItemsService.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'Osh' }),
      );
    });
  });
});
