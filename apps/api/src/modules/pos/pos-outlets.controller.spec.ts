import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PosOutletsController } from './pos-outlets.controller';
import { PosOutletsService } from './pos-outlets.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-pos-outlets-controller';

describe('PosOutletsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let posOutletsService: { listByProperty: jest.Mock; create: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    posOutletsService = {
      listByProperty: jest.fn(),
      create: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PosOutletsController],
      providers: [
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

  describe('GET /properties/:propertyId/pos-outlets', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/pos-outlets')
        .expect(401);
      expect(posOutletsService.listByProperty).not.toHaveBeenCalled();
    });

    it("pos:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/pos-outlets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(posOutletsService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      posOutletsService.listByProperty.mockResolvedValue([{ id: 'po1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/pos-outlets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(posOutletsService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('POST /properties/:propertyId/pos-outlets', () => {
    it("pos:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/pos-outlets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Restoran' })
        .expect(403);
      expect(posOutletsService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa savdo nuqtasini yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['pos:create']),
      );
      posOutletsService.create.mockResolvedValue({ id: 'po-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/pos-outlets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Restoran' })
        .expect(201);

      expect(posOutletsService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'Restoran',
      );
    });
  });
});
