import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-bookings-controller';

// Bu controller `@UseGuards(JwtAuthGuard, PermissionsGuard)` + har bir
// endpointda turli modul (`booking` yoki `front_desk`) bo'yicha
// `@RequirePermission` bilan himoyalangan. Sinov HAQIQIY guard zanjirini
// HTTP orqali ko'taradi — ayniqsa check-in/check-out `front_desk:approve`
// talab qilishini, oddiy bron ko'rish/yaratish esa `booking:view`/`create`
// talab qilishini tekshiradi (turli endpoint bir xil controllerda turli
// modul ostida bo'lishi — bu kabi xatolarni faqat HTTP darajasidagi test
// ushlay oladi, chunki dekorator controller metadatasida, service kodida
// emas).
describe('BookingsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let bookingsService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    cancel: jest.Mock;
    confirm: jest.Mock;
    changeRoom: jest.Mock;
    updateDates: jest.Mock;
    checkIn: jest.Mock;
    checkOut: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    bookingsService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      confirm: jest.fn(),
      changeRoom: jest.fn(),
      updateDates: jest.fn(),
      checkIn: jest.fn(),
      checkOut: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [BookingsController],
      providers: [
        { provide: BookingsService, useValue: bookingsService },
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

  describe('GET /properties/:propertyId/bookings', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/bookings')
        .expect(401);
      expect(bookingsService.listByProperty).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(bookingsService.listByProperty).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati bo'lsa 200 va joriy tenant/property bronlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      bookingsService.listByProperty.mockResolvedValue([{ id: 'b1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      // propertyId guard ichida request.params dan olinadi, permission tekshiruvi
      // shu propertyId bilan bog'liq bo'lishi kerak — tenantId esa tokendan.
      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        'p1',
      );
      expect(bookingsService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        undefined,
        undefined,
      );
    });
  });

  describe('POST /properties/:propertyId/bookings', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', checkIn: '2026-10-01', checkOut: '2026-10-03' })
        .expect(403);
      expect(bookingsService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangi bronni joriy tenant/property'da yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      bookingsService.create.mockResolvedValue({ id: 'new-b1' });

      await request(app.getHttpServer())
        .post('/properties/p1/bookings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', checkIn: '2026-10-01', checkOut: '2026-10-03' })
        .expect(201);

      expect(bookingsService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ roomId: 'r1' }),
      );
    });
  });

  describe('POST /properties/:propertyId/bookings/:id/check-in — front_desk:approve talab qiladi (booking:* emas)', () => {
    it("faqat booking:edit ruxsati bo'lsa ham 403 qaytaradi (noto'g'ri modul)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view', 'booking:create', 'booking:edit']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/bookings/b1/check-in')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(bookingsService.checkIn).not.toHaveBeenCalled();
    });

    it("front_desk:approve ruxsati bo'lsa 201 va check-in bajaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:approve']),
      );
      bookingsService.checkIn.mockResolvedValue({
        id: 'b1',
        status: 'checked_in',
      });

      await request(app.getHttpServer())
        .post('/properties/p1/bookings/b1/check-in')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(bookingsService.checkIn).toHaveBeenCalledWith('t1', 'p1', 'b1');
    });
  });

  describe('POST /properties/:propertyId/bookings/:id/change-room — front_desk:edit talab qiladi', () => {
    it("front_desk:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/bookings/b1/change-room')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ newRoomId: 'r2' })
        .expect(403);
      expect(bookingsService.changeRoom).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa xona almashtiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['front_desk:edit']),
      );
      bookingsService.changeRoom.mockResolvedValue({ id: 'b1', roomId: 'r2' });

      await request(app.getHttpServer())
        .post('/properties/p1/bookings/b1/change-room')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ newRoomId: 'r2' })
        .expect(201);

      expect(bookingsService.changeRoom).toHaveBeenCalledWith(
        't1',
        'p1',
        'b1',
        expect.objectContaining({ newRoomId: 'r2' }),
      );
    });
  });
});
