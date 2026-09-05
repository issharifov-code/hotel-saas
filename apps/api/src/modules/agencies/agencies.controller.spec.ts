import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { AgencyCommissionsService } from './agency-commissions.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-agencies-controller';

// Turizm agentliklari (Travel Agents / Corporate Accounts) — alohida
// PermissionModule yo'q, mavjud BOOKING moduli ostida himoyalangan
// (controllerning o'z izohiga ko'ra ataylab shunday).
describe('AgenciesController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let agenciesService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let commissionsService: {
    getSummary: jest.Mock;
    listByAgency: jest.Mock;
    listPayments: jest.Mock;
    pay: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    agenciesService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    commissionsService = {
      getSummary: jest.fn(),
      listByAgency: jest.fn(),
      listPayments: jest.fn(),
      pay: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AgenciesController],
      providers: [
        { provide: AgenciesService, useValue: agenciesService },
        { provide: AgencyCommissionsService, useValue: commissionsService },
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

  describe('GET /properties/:propertyId/agencies', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/agencies')
        .expect(401);
      expect(agenciesService.listByProperty).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/agencies')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(agenciesService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      agenciesService.listByProperty.mockResolvedValue([{ id: 'ag1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/agencies')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(agenciesService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/agencies/:id', () => {
    it("ruxsat bo'lsa agentlikni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      agenciesService.findById.mockResolvedValue({ id: 'ag1' });

      await request(app.getHttpServer())
        .get('/properties/p1/agencies/ag1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(agenciesService.findById).toHaveBeenCalledWith('t1', 'p1', 'ag1');
    });
  });

  describe('GET /properties/:propertyId/agencies/:id/summary', () => {
    it("ruxsat bo'lsa xulosani qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      commissionsService.getSummary.mockResolvedValue({ totalBookings: 5 });

      await request(app.getHttpServer())
        .get('/properties/p1/agencies/ag1/summary')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(commissionsService.getSummary).toHaveBeenCalledWith(
        't1',
        'p1',
        'ag1',
      );
    });
  });

  describe('POST /properties/:propertyId/agencies', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi (booking:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/agencies')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Silk Road Travel' })
        .expect(403);
      expect(agenciesService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa agentlik yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      agenciesService.create.mockResolvedValue({ id: 'ag-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/agencies')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Silk Road Travel' })
        .expect(201);

      expect(agenciesService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Silk Road Travel' }),
      );
    });
  });

  describe('PATCH /properties/:propertyId/agencies/:id', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/agencies/ag1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ commissionRate: 10 })
        .expect(403);
      expect(agenciesService.update).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      agenciesService.update.mockResolvedValue({ id: 'ag1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/agencies/ag1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ commissionRate: 10 })
        .expect(200);

      expect(agenciesService.update).toHaveBeenCalledWith(
        't1',
        'p1',
        'ag1',
        expect.objectContaining({ commissionRate: 10 }),
      );
    });
  });
});
