import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-suppliers-controller';

describe('SuppliersController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let suppliersService: { list: jest.Mock; create: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    suppliersService = {
      list: jest.fn(),
      create: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [SuppliersController],
      providers: [
        { provide: SuppliersService, useValue: suppliersService },
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

  describe('GET /suppliers', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/suppliers').expect(401);
      expect(suppliersService.list).not.toHaveBeenCalled();
    });

    it("warehouse:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(suppliersService.list).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      suppliersService.list.mockResolvedValue([{ id: 's1' }]);

      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(suppliersService.list).toHaveBeenCalledWith('t1');
    });
  });

  describe('POST /suppliers', () => {
    it("warehouse:create ruxsati yo'q bo'lsa 403 qaytaradi (warehouse:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:view']),
      );
      await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: "Ta'minotchi MChJ" })
        .expect(403);
      expect(suppliersService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ta'minotchi yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['warehouse:create']),
      );
      suppliersService.create.mockResolvedValue({ id: 's-new' });

      await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: "Ta'minotchi MChJ" })
        .expect(201);

      expect(suppliersService.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: "Ta'minotchi MChJ" }),
      );
    });
  });
});
