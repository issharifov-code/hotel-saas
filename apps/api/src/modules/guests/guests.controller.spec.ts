import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-guests-controller';

// Mehmon PII (shaxsiy ma'lumot) — `guest_crm` moduli ostida. `merge`
// (ikkilanma mehmonlarni birlashtirish) buzilmas (destruktiv) amal bo'lgani
// uchun ataylab DELETE action talab qiladi, EDIT emas — bu HTTP darajasida
// alohida tekshiriladi. Shuningdek `GET /guests/duplicates` route'i
// `GET /guests/:id`dan OLDIN e'lon qilingani (controllerdagi izohga
// ko'ra) to'g'ri ishlashi — ya'ni "duplicates" `:id` sifatida
// moslashtirilmasligi — muvaffaqiyatli chaqiruv orqali tasdiqlanadi.
describe('GuestsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let guestsService: {
    list: jest.Mock;
    findDuplicateGroups: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    getStayHistory: jest.Mock;
    mergeGuests: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    guestsService = {
      list: jest.fn(),
      findDuplicateGroups: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      getStayHistory: jest.fn(),
      mergeGuests: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [GuestsController],
      providers: [
        { provide: GuestsService, useValue: guestsService },
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

  describe('GET /guests', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/guests').expect(401);
      expect(guestsService.list).not.toHaveBeenCalled();
    });

    it("guest_crm:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/guests')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(guestsService.list).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa qidiruv so'zi bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      guestsService.list.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/guests?search=Aliyev')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(guestsService.list).toHaveBeenCalledWith('t1', {
        search: 'Aliyev',
        name: undefined,
        communication: undefined,
        documentNumber: undefined,
        nationality: undefined,
      });
    });

    // 2026-09-04: alohida qidiruv maydonlari (OPERA "Manage Profile" uslubi).
    it('alohida maydonlar servisga to\'liq uzatiladi', async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      guestsService.list.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/guests?name=Ali&communication=998&documentNumber=AA12&nationality=UZ')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(guestsService.list).toHaveBeenCalledWith('t1', {
        search: undefined,
        name: 'Ali',
        communication: '998',
        documentNumber: 'AA12',
        nationality: 'UZ',
      });
    });
  });

  describe("GET /guests/duplicates — /:id'dan oldin to'g'ri marshrutlanadi", () => {
    it("guest_crm:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/guests/duplicates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(guestsService.findDuplicateGroups).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa findDuplicateGroups chaqiriladi (findById EMAS)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      guestsService.findDuplicateGroups.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/guests/duplicates')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(guestsService.findDuplicateGroups).toHaveBeenCalledWith('t1');
      expect(guestsService.findById).not.toHaveBeenCalled();
    });
  });

  describe('GET /guests/:id', () => {
    it("ruxsat bo'lsa mehmonni tenantId bilan qidiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      guestsService.findById.mockResolvedValue({ id: 'g1' });

      await request(app.getHttpServer())
        .get('/guests/g1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(guestsService.findById).toHaveBeenCalledWith('t1', 'g1');
    });
  });

  describe('POST /guests', () => {
    it("guest_crm:create ruxsati yo'q bo'lsa 403 qaytaradi (guest_crm:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      await request(app.getHttpServer())
        .post('/guests')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ fullName: 'Aziz Aliyev' })
        .expect(403);
      expect(guestsService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa mehmon yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:create']),
      );
      guestsService.create.mockResolvedValue({ id: 'g-new' });

      await request(app.getHttpServer())
        .post('/guests')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ fullName: 'Aziz Aliyev' })
        .expect(201);

      expect(guestsService.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ fullName: 'Aziz Aliyev' }),
      );
    });
  });

  describe('PATCH /guests/:id', () => {
    it("guest_crm:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/guests/g1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ phone: '+998901112233' })
        .expect(403);
      expect(guestsService.update).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:edit']),
      );
      guestsService.update.mockResolvedValue({ id: 'g1' });

      await request(app.getHttpServer())
        .patch('/guests/g1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ phone: '+998901112233' })
        .expect(200);

      expect(guestsService.update).toHaveBeenCalledWith(
        't1',
        'g1',
        expect.objectContaining({ phone: '+998901112233' }),
      );
    });
  });

  describe('GET /guests/:id/stays', () => {
    it("ruxsat bo'lsa turish tarixini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      guestsService.getStayHistory.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/guests/g1/stays')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(guestsService.getStayHistory).toHaveBeenCalledWith('t1', 'g1');
    });
  });

  describe('POST /guests/:id/merge — DELETE action talab qiladi (EDIT emas)', () => {
    it("guest_crm:edit ruxsati bo'lsa ham 403 qaytaradi (birlashtirish buzilmas amal)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view', 'guest_crm:create', 'guest_crm:edit']),
      );
      await request(app.getHttpServer())
        .post('/guests/g1/merge')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ duplicateGuestId: 'g2' })
        .expect(403);
      expect(guestsService.mergeGuests).not.toHaveBeenCalled();
    });

    it("guest_crm:delete ruxsati bo'lsa mehmonlarni birlashtiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:delete']),
      );
      guestsService.mergeGuests.mockResolvedValue({ id: 'g1' });

      await request(app.getHttpServer())
        .post('/guests/g1/merge')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ duplicateGuestId: 'g2' })
        .expect(201);

      expect(guestsService.mergeGuests).toHaveBeenCalledWith('t1', 'g1', 'g2');
    });
  });
});
