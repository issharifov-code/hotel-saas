import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { RoomsController } from './rooms.controller';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';
import { RatePlansService } from './rate-plans.service';
import { RatePlanRestrictionsService } from './rate-plan-restrictions.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-rooms-controller';

// Xona turlari, xonalar, narx rejalari va narx-cheklovlari — hammasi
// `booking` moduli ostida (revenue-management funksiyalari alohida modulga
// ega emas). Bu spec fayl har bir endpoint uchun to'g'ri action
// (view/create/edit) talab qilinishini va yozish amallarida
// `tenantId`/`propertyId` FAQAT tokendan/URL'dan kelishini tekshiradi.
describe('RoomsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let roomTypesService: { listByProperty: jest.Mock; create: jest.Mock };
  let roomsService: { listByProperty: jest.Mock; create: jest.Mock };
  let ratePlansService: {
    listByProperty: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let ratePlanRestrictionsService: {
    listForRatePlan: jest.Mock;
    upsert: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    roomTypesService = { listByProperty: jest.fn(), create: jest.fn() };
    roomsService = { listByProperty: jest.fn(), create: jest.fn() };
    ratePlansService = {
      listByProperty: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    ratePlanRestrictionsService = {
      listForRatePlan: jest.fn(),
      upsert: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [RoomsController],
      providers: [
        { provide: RoomTypesService, useValue: roomTypesService },
        { provide: RoomsService, useValue: roomsService },
        { provide: RatePlansService, useValue: ratePlansService },
        {
          provide: RatePlanRestrictionsService,
          useValue: ratePlanRestrictionsService,
        },
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

  describe('GET /properties/:propertyId/room-types', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/room-types')
        .expect(401);
      expect(roomTypesService.listByProperty).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/room-types')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(roomTypesService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      roomTypesService.listByProperty.mockResolvedValue([{ id: 'rt1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/room-types')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(roomTypesService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('POST /properties/:propertyId/room-types', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi (booking:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/room-types')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Standart' })
        .expect(403);
      expect(roomTypesService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa xona turini yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      roomTypesService.create.mockResolvedValue({ id: 'rt-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/room-types')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Standart' })
        .expect(201);

      expect(roomTypesService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Standart' }),
      );
    });
  });

  describe('GET /properties/:propertyId/rooms', () => {
    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(roomsService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      roomsService.listByProperty.mockResolvedValue([{ id: 'r1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(roomsService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('POST /properties/:propertyId/rooms', () => {
    it("ruxsat bo'lsa xona yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      roomsService.create.mockResolvedValue({ id: 'r-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomTypeId: 'rt1', number: '101' })
        .expect(201);

      expect(roomsService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ number: '101' }),
      );
    });
  });

  describe('GET /properties/:propertyId/rate-plans', () => {
    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/rate-plans')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(ratePlansService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa roomTypeId filtri bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      ratePlansService.listByProperty.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/rate-plans?roomTypeId=rt1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(ratePlansService.listByProperty).toHaveBeenCalledWith(
        't1',
        'p1',
        'rt1',
      );
    });
  });

  describe('POST /properties/:propertyId/rate-plans', () => {
    it("ruxsat bo'lsa narx rejasini yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      ratePlansService.create.mockResolvedValue({ id: 'rp-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/rate-plans')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomTypeId: 'rt1', name: 'Rack Rate', nightlyPrice: '100.00' })
        .expect(201);

      expect(ratePlansService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Rack Rate' }),
      );
    });
  });

  describe('PATCH /properties/:propertyId/rate-plans/:id', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi (booking:create yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      await request(app.getHttpServer())
        .patch('/properties/p1/rate-plans/rp1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ nightlyPrice: '120.00' })
        .expect(403);
      expect(ratePlansService.update).not.toHaveBeenCalled();
    });

    it("booking:edit ruxsati bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      ratePlansService.update.mockResolvedValue({ id: 'rp1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/rate-plans/rp1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ nightlyPrice: '120.00' })
        .expect(200);

      expect(ratePlansService.update).toHaveBeenCalledWith(
        't1',
        'p1',
        'rp1',
        expect.objectContaining({ nightlyPrice: '120.00' }),
      );
    });
  });

  describe('GET /properties/:propertyId/rate-plans/:ratePlanId/restrictions', () => {
    it("ruxsat bo'lsa sana oralig'i bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      ratePlanRestrictionsService.listForRatePlan.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(
          '/properties/p1/rate-plans/rp1/restrictions?from=2026-09-01&to=2026-09-30',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(ratePlanRestrictionsService.listForRatePlan).toHaveBeenCalledWith(
        't1',
        'p1',
        'rp1',
        '2026-09-01',
        '2026-09-30',
      );
    });
  });

  describe('PUT /properties/:propertyId/rate-plans/:ratePlanId/restrictions/:date', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .put('/properties/p1/rate-plans/rp1/restrictions/2026-09-15')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stopSell: true })
        .expect(403);
      expect(ratePlanRestrictionsService.upsert).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa cheklovni sana bo'yicha yozadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      ratePlanRestrictionsService.upsert.mockResolvedValue({ id: 'r1' });

      await request(app.getHttpServer())
        .put('/properties/p1/rate-plans/rp1/restrictions/2026-09-15')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ stopSell: true })
        .expect(200);

      expect(ratePlanRestrictionsService.upsert).toHaveBeenCalledWith(
        't1',
        'p1',
        'rp1',
        '2026-09-15',
        expect.objectContaining({ stopSell: true }),
      );
    });
  });
});
