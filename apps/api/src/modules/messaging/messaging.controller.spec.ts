import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-messaging-controller';

// Mehmonlarga xabar yuborish (email/SMS) — alohida PermissionModule yo'q,
// mavjud GUEST_CRM qayta ishlatiladi.
describe('MessagingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let messagingService: {
    listTemplates: jest.Mock;
    findTemplateById: jest.Mock;
    createTemplate: jest.Mock;
    updateTemplate: jest.Mock;
    listLogs: jest.Mock;
    sendMessage: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    messagingService = {
      listTemplates: jest.fn(),
      findTemplateById: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      listLogs: jest.fn(),
      sendMessage: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [MessagingController],
      providers: [
        { provide: MessagingService, useValue: messagingService },
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

  describe('GET /properties/:propertyId/message-templates', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/message-templates')
        .expect(401);
      expect(messagingService.listTemplates).not.toHaveBeenCalled();
    });

    it("guest_crm:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/message-templates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(messagingService.listTemplates).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa shablonlar ro'yxatini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      messagingService.listTemplates.mockResolvedValue([{ id: 'tmpl1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/message-templates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(messagingService.listTemplates).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/message-templates/:id', () => {
    it("ruxsat bo'lsa shablonni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      messagingService.findTemplateById.mockResolvedValue({ id: 'tmpl1' });

      await request(app.getHttpServer())
        .get('/properties/p1/message-templates/tmpl1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(messagingService.findTemplateById).toHaveBeenCalledWith(
        't1',
        'p1',
        'tmpl1',
      );
    });
  });

  describe('POST /properties/:propertyId/message-templates', () => {
    it("guest_crm:create ruxsati yo'q bo'lsa 403 qaytaradi (guest_crm:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/message-templates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Xush kelibsiz xabari', body: 'Salom, {{guestName}}!' })
        .expect(403);
      expect(messagingService.createTemplate).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa shablon yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:create']),
      );
      messagingService.createTemplate.mockResolvedValue({ id: 'tmpl-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/message-templates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ name: 'Xush kelibsiz xabari', body: 'Salom, {{guestName}}!' })
        .expect(201);

      expect(messagingService.createTemplate).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ name: 'Xush kelibsiz xabari' }),
      );
    });
  });

  describe('PATCH /properties/:propertyId/message-templates/:id', () => {
    it("guest_crm:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/message-templates/tmpl1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ body: 'Yangilangan matn' })
        .expect(403);
      expect(messagingService.updateTemplate).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:edit']),
      );
      messagingService.updateTemplate.mockResolvedValue({ id: 'tmpl1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/message-templates/tmpl1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ body: 'Yangilangan matn' })
        .expect(200);

      expect(messagingService.updateTemplate).toHaveBeenCalledWith(
        't1',
        'p1',
        'tmpl1',
        expect.objectContaining({ body: 'Yangilangan matn' }),
      );
    });
  });

  describe('GET /properties/:propertyId/message-logs', () => {
    it("ruxsat bo'lsa filtr va pagination to'g'ri uzatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      messagingService.listLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 20,
      });

      await request(app.getHttpServer())
        .get(
          '/properties/p1/message-logs?guestId=g1&bookingId=b1&page=2&pageSize=20',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(messagingService.listLogs).toHaveBeenCalledWith(
        't1',
        'p1',
        { guestId: 'g1', bookingId: 'b1' },
        { page: 2, pageSize: 20, skip: 20, take: 20 },
      );
    });

    it("query yo'q bo'lsa standart pageSize (50) bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      messagingService.listLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/message-logs')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(messagingService.listLogs).toHaveBeenCalledWith(
        't1',
        'p1',
        { guestId: undefined, bookingId: undefined },
        { page: 1, pageSize: 50, skip: 0, take: 50 },
      );
    });
  });

  describe('POST /properties/:propertyId/messages/send', () => {
    it("guest_crm:create ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/messages/send')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ guestId: 'g1', channel: 'email', body: 'Salom' })
        .expect(403);
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa xabarni tokendagi userId bilan yuboradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:create']),
      );
      messagingService.sendMessage.mockResolvedValue({ id: 'msg1' });

      await request(app.getHttpServer())
        .post('/properties/p1/messages/send')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ guestId: 'g1', channel: 'email', body: 'Salom' })
        .expect(201);

      expect(messagingService.sendMessage).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ guestId: 'g1' }),
        'u1',
      );
    });
  });
});
