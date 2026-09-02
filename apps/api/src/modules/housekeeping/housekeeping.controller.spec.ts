import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-housekeeping-controller';

// `housekeeping` moduli — VIEW/CREATE/EDIT'dan tashqari `inspect` uchun
// alohida APPROVE action ishlatiladi (tozalovchi vazifani boshlaydi/
// yakunlaydi — EDIT, lekin nazoratchi tekshiruvi — APPROVE, yuqoriroq
// imtiyoz). Bu HTTP darajasida alohida tekshiriladi.
describe('HousekeepingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let housekeepingService: {
    listRoomStatuses: jest.Mock;
    listTasks: jest.Mock;
    createTask: jest.Mock;
    start: jest.Mock;
    complete: jest.Mock;
    inspect: jest.Mock;
    cancel: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    housekeepingService = {
      listRoomStatuses: jest.fn(),
      listTasks: jest.fn(),
      createTask: jest.fn(),
      start: jest.fn(),
      complete: jest.fn(),
      inspect: jest.fn(),
      cancel: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [HousekeepingController],
      providers: [
        { provide: HousekeepingService, useValue: housekeepingService },
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

  describe('GET /properties/:propertyId/housekeeping/rooms', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/housekeeping/rooms')
        .expect(401);
      expect(housekeepingService.listRoomStatuses).not.toHaveBeenCalled();
    });

    it("housekeeping:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/housekeeping/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(housekeepingService.listRoomStatuses).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:view']),
      );
      housekeepingService.listRoomStatuses.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/housekeeping/rooms')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(housekeepingService.listRoomStatuses).toHaveBeenCalledWith(
        't1',
        'p1',
      );
    });
  });

  describe('POST /properties/:propertyId/housekeeping/tasks', () => {
    it("housekeeping:create ruxsati yo'q bo'lsa 403 qaytaradi (housekeeping:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', taskType: 'cleaning' })
        .expect(403);
      expect(housekeepingService.createTask).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa vazifa yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:create']),
      );
      housekeepingService.createTask.mockResolvedValue({ id: 'task1' });

      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ roomId: 'r1', taskType: 'cleaning' })
        .expect(201);

      expect(housekeepingService.createTask).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ roomId: 'r1' }),
      );
    });
  });

  describe('POST /properties/:propertyId/housekeeping/tasks/:id/start', () => {
    it("housekeeping:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/start')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(housekeepingService.start).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa vazifani tokendagi userId bilan boshlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      housekeepingService.start.mockResolvedValue({ id: 'task1' });

      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/start')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(housekeepingService.start).toHaveBeenCalledWith(
        't1',
        'p1',
        'task1',
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/housekeeping/tasks/:id/inspect', () => {
    it("housekeeping:edit ruxsati bo'lsa ham 403 qaytaradi (nazorat uchun APPROVE talab qilinadi)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set([
          'housekeeping:view',
          'housekeeping:create',
          'housekeeping:edit',
        ]),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/inspect')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(housekeepingService.inspect).not.toHaveBeenCalled();
    });

    it("housekeeping:approve ruxsati bo'lsa tekshiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:approve']),
      );
      housekeepingService.inspect.mockResolvedValue({ id: 'task1' });

      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/inspect')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(housekeepingService.inspect).toHaveBeenCalledWith(
        't1',
        'p1',
        'task1',
        'u1',
      );
    });
  });

  describe('POST /properties/:propertyId/housekeeping/tasks/:id/complete', () => {
    it("ruxsat bo'lsa vazifani yakunlaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      housekeepingService.complete.mockResolvedValue({ id: 'task1' });

      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/complete')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(housekeepingService.complete).toHaveBeenCalledWith(
        't1',
        'p1',
        'task1',
      );
    });
  });

  describe('POST /properties/:propertyId/housekeeping/tasks/:id/cancel', () => {
    it("housekeeping:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(housekeepingService.cancel).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa vazifani bekor qiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['housekeeping:edit']),
      );
      housekeepingService.cancel.mockResolvedValue({ id: 'task1' });

      await request(app.getHttpServer())
        .post('/properties/p1/housekeeping/tasks/task1/cancel')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(201);

      expect(housekeepingService.cancel).toHaveBeenCalledWith(
        't1',
        'p1',
        'task1',
      );
    });
  });
});
