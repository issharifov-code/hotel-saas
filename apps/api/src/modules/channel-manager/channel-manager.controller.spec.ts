import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { ChannelManagerController } from './channel-manager.controller';
import { ChannelManagerService } from './channel-manager.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-channel-manager-controller';

// Channel Manager — inventar/mavjudlik-distribution mavzusi bo'lgani uchun
// alohida PermissionModule yo'q, mavjud BOOKING moduli qayta ishlatiladi
// (Rate Plan Restrictions bilan bir xil naqsh).
describe('ChannelManagerController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let channelManagerService: {
    listChannels: jest.Mock;
    createChannel: jest.Mock;
    findChannelById: jest.Mock;
    updateChannel: jest.Mock;
    listMappings: jest.Mock;
    upsertMapping: jest.Mock;
    listSyncLogs: jest.Mock;
    syncChannel: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    channelManagerService = {
      listChannels: jest.fn(),
      createChannel: jest.fn(),
      findChannelById: jest.fn(),
      updateChannel: jest.fn(),
      listMappings: jest.fn(),
      upsertMapping: jest.fn(),
      listSyncLogs: jest.fn(),
      syncChannel: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [ChannelManagerController],
      providers: [
        { provide: ChannelManagerService, useValue: channelManagerService },
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

  describe('GET /properties/:propertyId/channels', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/channels')
        .expect(401);
      expect(channelManagerService.listChannels).not.toHaveBeenCalled();
    });

    it("booking:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/channels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(channelManagerService.listChannels).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa kanallar ro'yxatini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      channelManagerService.listChannels.mockResolvedValue([{ id: 'ch1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/channels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(channelManagerService.listChannels).toHaveBeenCalledWith(
        't1',
        'p1',
      );
    });
  });

  describe('POST /properties/:propertyId/channels', () => {
    it("booking:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/channels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Booking.com' })
        .expect(403);
      expect(channelManagerService.createChannel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa kanal yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:create']),
      );
      channelManagerService.createChannel.mockResolvedValue({ id: 'ch-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/channels')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Booking.com' })
        .expect(201);

      expect(channelManagerService.createChannel).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Booking.com' }),
      );
    });
  });

  describe('GET /properties/:propertyId/channels/:id', () => {
    it("ruxsat bo'lsa kanalni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      channelManagerService.findChannelById.mockResolvedValue({ id: 'ch1' });

      await request(app.getHttpServer())
        .get('/properties/p1/channels/ch1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(channelManagerService.findChannelById).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
      );
    });
  });

  describe('PATCH /properties/:propertyId/channels/:id', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/channels/ch1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ isActive: false })
        .expect(403);
      expect(channelManagerService.updateChannel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      channelManagerService.updateChannel.mockResolvedValue({ id: 'ch1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/channels/ch1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ isActive: false })
        .expect(200);

      expect(channelManagerService.updateChannel).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('GET /properties/:propertyId/channels/:id/mappings', () => {
    it("ruxsat bo'lsa xonalanish ro'yxatini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      channelManagerService.listMappings.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/channels/ch1/mappings')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(channelManagerService.listMappings).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
      );
    });
  });

  describe('PUT /properties/:propertyId/channels/:id/mappings/:roomTypeId', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .put('/properties/p1/channels/ch1/mappings/rt1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ externalRoomTypeId: 'ext-rt1' })
        .expect(403);
      expect(channelManagerService.upsertMapping).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa xonalanishni yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      channelManagerService.upsertMapping.mockResolvedValue({ id: 'map1' });

      await request(app.getHttpServer())
        .put('/properties/p1/channels/ch1/mappings/rt1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ externalRoomTypeId: 'ext-rt1' })
        .expect(200);

      expect(channelManagerService.upsertMapping).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
        'rt1',
        expect.objectContaining({ externalRoomTypeId: 'ext-rt1' }),
      );
    });
  });

  describe('GET /properties/:propertyId/channels/:id/sync-logs', () => {
    it("ruxsat bo'lsa page/pageSize'ni to'g'ri shaklga o'girib uzatadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      channelManagerService.listSyncLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/channels/ch1/sync-logs?page=2&pageSize=10')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(channelManagerService.listSyncLogs).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
        { page: 2, pageSize: 10, skip: 10, take: 10 },
      );
    });

    it("query yo'q bo'lsa standart pageSize (30) bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      channelManagerService.listSyncLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 30,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/channels/ch1/sync-logs')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(channelManagerService.listSyncLogs).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
        { page: 1, pageSize: 30, skip: 0, take: 30 },
      );
    });
  });

  describe('POST /properties/:propertyId/channels/:id/sync', () => {
    it("booking:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/channels/ch1/sync')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(channelManagerService.syncChannel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa sinxronlashni ishga tushiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:edit']),
      );
      channelManagerService.syncChannel.mockResolvedValue({ status: 'ok' });

      await request(app.getHttpServer())
        .post('/properties/p1/channels/ch1/sync')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(channelManagerService.syncChannel).toHaveBeenCalledWith(
        't1',
        'p1',
        'ch1',
      );
    });
  });
});
