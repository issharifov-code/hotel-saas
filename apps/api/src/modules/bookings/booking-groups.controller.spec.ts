import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { BookingGroupsController } from './booking-groups.controller';
import { BookingsService } from './bookings.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-booking-groups-controller';

// Guruh/blok bron endpointlari mavjud `booking` permission modulidan
// foydalanadi (yangi modul qo'shilmagan) — shu sababli bu yerda asosiy
// maqsad guard zanjirining ishlashini va tenantId/propertyId'ning
// tokendan/URL'dan to'g'ri kelishini tasdiqlash.
describe('BookingGroupsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let bookingsService: {
    listGroups: jest.Mock;
    findGroupById: jest.Mock;
    createGroup: jest.Mock;
    addRoomToGroup: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    bookingsService = {
      listGroups: jest.fn(),
      findGroupById: jest.fn(),
      createGroup: jest.fn(),
      addRoomToGroup: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [BookingGroupsController],
      providers: [
        { provide: BookingsService, useValue: bookingsService },
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

  describe('GET /properties/:propertyId/booking-groups', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/booking-groups')
        .expect(401);
      expect(bookingsService.listGroups).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/booking-groups')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(bookingsService.listGroups).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati bo'lsa 200 va joriy tenant/property guruhlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      bookingsService.listGroups.mockResolvedValue([{ id: 'g1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/booking-groups')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        'p1',
      );
      expect(bookingsService.listGroups).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/booking-groups/:id', () => {
    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/booking-groups/g1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(bookingsService.findGroupById).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa berilgan guruhni joriy tenant/property ostida qidiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      bookingsService.findGroupById.mockResolvedValue({ id: 'g1' });

      await request(app.getHttpServer())
        .get('/properties/p1/booking-groups/g1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(bookingsService.findGroupById).toHaveBeenCalledWith(
        't1',
        'p1',
        'g1',
      );
    });
  });

  describe('POST /properties/:propertyId/booking-groups', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi (booking:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/booking-groups')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Konferensiya guruhi' })
        .expect(403);
      expect(bookingsService.createGroup).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa guruhni joriy tenant/property'da, tokendagi userId bilan yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      bookingsService.createGroup.mockResolvedValue({ id: 'new-g1' });

      await request(app.getHttpServer())
        .post('/properties/p1/booking-groups')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Konferensiya guruhi' })
        .expect(201);

      expect(bookingsService.createGroup).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        expect.objectContaining({ name: 'Konferensiya guruhi' }),
      );
    });
  });

  describe('POST /properties/:propertyId/booking-groups/:id/rooms', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/booking-groups/g1/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1' })
        .expect(403);
      expect(bookingsService.addRoomToGroup).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa guruhga xona qo'shadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      bookingsService.addRoomToGroup.mockResolvedValue({ id: 'g1' });

      await request(app.getHttpServer())
        .post('/properties/p1/booking-groups/g1/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1' })
        .expect(201);

      expect(bookingsService.addRoomToGroup).toHaveBeenCalledWith(
        't1',
        'p1',
        'g1',
        expect.objectContaining({ roomId: 'r1' }),
      );
    });
  });
});
