import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { FunctionSpaceBookingsController } from './function-space-bookings.controller';
import { FunctionSpacesService } from './function-spaces.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-function-space-bookings-controller';

// Tadbir bronlari — FunctionSpacesController'dan alohida controller (marshrut
// prefiksi farqli), lekin bir xil servis va BOOKING moduli ostida.
describe('FunctionSpaceBookingsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let functionSpacesService: {
    listBookings: jest.Mock;
    findBookingById: jest.Mock;
    createBooking: jest.Mock;
    updateBooking: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    functionSpacesService = {
      listBookings: jest.fn(),
      findBookingById: jest.fn(),
      createBooking: jest.fn(),
      updateBooking: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [FunctionSpaceBookingsController],
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

  describe('GET /properties/:propertyId/function-space-bookings', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/function-space-bookings')
        .expect(401);
      expect(functionSpacesService.listBookings).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/function-space-bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(functionSpacesService.listBookings).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa functionSpaceId filtri bilan qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      functionSpacesService.listBookings.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/function-space-bookings?functionSpaceId=fs1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(functionSpacesService.listBookings).toHaveBeenCalledWith(
        't1',
        'p1',
        { functionSpaceId: 'fs1' },
      );
    });
  });

  describe('GET /properties/:propertyId/function-space-bookings/:id', () => {
    it("ruxsat bo'lsa bronni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      functionSpacesService.findBookingById.mockResolvedValue({ id: 'fsb1' });

      await request(app.getHttpServer())
        .get('/properties/p1/function-space-bookings/fsb1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(functionSpacesService.findBookingById).toHaveBeenCalledWith(
        't1',
        'p1',
        'fsb1',
      );
    });
  });

  describe('POST /properties/:propertyId/function-space-bookings', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/function-space-bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ functionSpaceId: 'fs1', eventName: 'Konferensiya' })
        .expect(403);
      expect(functionSpacesService.createBooking).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa bronni tokendagi userId bilan yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      functionSpacesService.createBooking.mockResolvedValue({
        id: 'fsb-new',
      });

      await request(app.getHttpServer())
        .post('/properties/p1/function-space-bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ functionSpaceId: 'fs1', eventName: 'Konferensiya' })
        .expect(201);

      expect(functionSpacesService.createBooking).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ eventName: 'Konferensiya' }),
        'u1',
      );
    });
  });

  describe('PATCH /properties/:propertyId/function-space-bookings/:id', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/function-space-bookings/fsb1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ eventName: "Yig'ilish" })
        .expect(403);
      expect(functionSpacesService.updateBooking).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      functionSpacesService.updateBooking.mockResolvedValue({ id: 'fsb1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/function-space-bookings/fsb1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ eventName: "Yig'ilish" })
        .expect(200);

      expect(functionSpacesService.updateBooking).toHaveBeenCalledWith(
        't1',
        'p1',
        'fsb1',
        expect.objectContaining({ eventName: "Yig'ilish" }),
      );
    });
  });
});
