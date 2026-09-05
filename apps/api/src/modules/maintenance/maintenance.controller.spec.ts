import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-maintenance-controller';

// Texnik xizmat so'rovlari (Maintenance) — alohida PermissionModule yo'q,
// mavjud HOUSEKEEPING moduli qayta ishlatiladi (eng yaqin operatsion
// vazifa turi — "xona holatini boshqarish" oilasidan).
describe('MaintenanceController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let maintenanceService: {
    listTickets: jest.Mock;
    findTicketById: jest.Mock;
    createTicket: jest.Mock;
    start: jest.Mock;
    resolve: jest.Mock;
    cancel: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    maintenanceService = {
      listTickets: jest.fn(),
      findTicketById: jest.fn(),
      createTicket: jest.fn(),
      start: jest.fn(),
      resolve: jest.fn(),
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
      controllers: [MaintenanceController],
      providers: [
        { provide: MaintenanceService, useValue: maintenanceService },
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

  describe('GET /properties/:propertyId/maintenance-tickets', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/maintenance-tickets')
        .expect(401);
      expect(maintenanceService.listTickets).not.toHaveBeenCalled();
    });

    it("housekeeping:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/maintenance-tickets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(maintenanceService.listTickets).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa status filtri bilan qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:view']),
      );
      maintenanceService.listTickets.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/maintenance-tickets?status=open')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(maintenanceService.listTickets).toHaveBeenCalledWith(
        't1',
        'p1',
        'open',
      );
    });
  });

  describe('GET /properties/:propertyId/maintenance-tickets/:id', () => {
    it("ruxsat bo'lsa so'rovni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:view']),
      );
      maintenanceService.findTicketById.mockResolvedValue({ id: 'mt1' });

      await request(app.getHttpServer())
        .get('/properties/p1/maintenance-tickets/mt1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(maintenanceService.findTicketById).toHaveBeenCalledWith(
        't1',
        'p1',
        'mt1',
      );
    });
  });

  describe('POST /properties/:propertyId/maintenance-tickets', () => {
    it("housekeeping:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', description: 'Konditsioner ishlamayapti' })
        .expect(403);
      expect(maintenanceService.createTicket).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa so'rovni tokendagi userId bilan yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:create']),
      );
      maintenanceService.createTicket.mockResolvedValue({ id: 'mt-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', description: 'Konditsioner ishlamayapti' })
        .expect(201);

      expect(maintenanceService.createTicket).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ roomId: 'r1' }),
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/maintenance-tickets/:id/start', () => {
    it("housekeeping:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets/mt1/start')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(maintenanceService.start).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa so'rovni tokendagi userId bilan boshlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      maintenanceService.start.mockResolvedValue({ id: 'mt1' });

      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets/mt1/start')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(maintenanceService.start).toHaveBeenCalledWith(
        't1',
        'p1',
        'mt1',
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/maintenance-tickets/:id/resolve', () => {
    it("ruxsat bo'lsa so'rovni yopadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      maintenanceService.resolve.mockResolvedValue({ id: 'mt1' });

      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets/mt1/resolve')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ resolutionNotes: 'Almashtirildi' })
        .expect(201);

      expect(maintenanceService.resolve).toHaveBeenCalledWith(
        't1',
        'p1',
        'mt1',
        expect.objectContaining({ resolutionNotes: 'Almashtirildi' }),
      );
    });
  });

  describe('POST /properties/:propertyId/maintenance-tickets/:id/cancel', () => {
    it("housekeeping:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets/mt1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(maintenanceService.cancel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa so'rovni bekor qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      maintenanceService.cancel.mockResolvedValue({ id: 'mt1' });

      await request(app.getHttpServer())
        .post('/properties/p1/maintenance-tickets/mt1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(maintenanceService.cancel).toHaveBeenCalledWith('t1', 'p1', 'mt1');
    });
  });
});
