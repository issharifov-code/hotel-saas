import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { FunctionSpacesController } from './function-spaces.controller';
import { FunctionSpacesService } from './function-spaces.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-function-spaces-controller';

// Function Space / Events (banket zali, konferensiya xonasi) — alohida
// PermissionModule yo'q, mavjud BOOKING moduli qayta ishlatiladi.
describe('FunctionSpacesController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let functionSpacesService: {
    listSpaces: jest.Mock;
    findSpaceById: jest.Mock;
    createSpace: jest.Mock;
    updateSpace: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    functionSpacesService = {
      listSpaces: jest.fn(),
      findSpaceById: jest.fn(),
      createSpace: jest.fn(),
      updateSpace: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [FunctionSpacesController],
      providers: [
        { provide: FunctionSpacesService, useValue: functionSpacesService },
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

  describe('GET /properties/:propertyId/function-spaces', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/function-spaces')
        .expect(401);
      expect(functionSpacesService.listSpaces).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/function-spaces')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(functionSpacesService.listSpaces).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      functionSpacesService.listSpaces.mockResolvedValue([{ id: 'fs1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/function-spaces')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(functionSpacesService.listSpaces).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/function-spaces/:id', () => {
    it("ruxsat bo'lsa zalni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      functionSpacesService.findSpaceById.mockResolvedValue({ id: 'fs1' });

      await request(app.getHttpServer())
        .get('/properties/p1/function-spaces/fs1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(functionSpacesService.findSpaceById).toHaveBeenCalledWith(
        't1',
        'p1',
        'fs1',
      );
    });
  });

  describe('POST /properties/:propertyId/function-spaces', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi (booking:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/function-spaces')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Katta zal', capacity: 200 })
        .expect(403);
      expect(functionSpacesService.createSpace).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa zal yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      functionSpacesService.createSpace.mockResolvedValue({ id: 'fs-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/function-spaces')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Katta zal', capacity: 200 })
        .expect(201);

      expect(functionSpacesService.createSpace).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Katta zal' }),
      );
    });
  });

  describe('PATCH /properties/:propertyId/function-spaces/:id', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/function-spaces/fs1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ capacity: 250 })
        .expect(403);
      expect(functionSpacesService.updateSpace).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      functionSpacesService.updateSpace.mockResolvedValue({ id: 'fs1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/function-spaces/fs1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ capacity: 250 })
        .expect(200);

      expect(functionSpacesService.updateSpace).toHaveBeenCalledWith(
        't1',
        'p1',
        'fs1',
        expect.objectContaining({ capacity: 250 }),
      );
    });
  });
});
