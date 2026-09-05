import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-loyalty-controller';

// Mehmon sodiqlik ballari — `guests` moduli ichida, `guest_crm` PermissionModule
// ostida (alohida modul yo'q). `adjust` — ballarni qo'lda o'zgartirish, moliyaviy
// ta'sirga ega bo'lgani uchun `guest_crm:edit` talab qiladi (`view` yetarli emas).
describe('LoyaltyController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let loyaltyService: {
    getTransactions: jest.Mock;
    adjustPoints: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    loyaltyService = {
      getTransactions: jest.fn(),
      adjustPoints: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [LoyaltyController],
      providers: [
        { provide: LoyaltyService, useValue: loyaltyService },
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

  describe('GET /guests/:guestId/loyalty/transactions', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/guests/g1/loyalty/transactions')
        .expect(401);
      expect(loyaltyService.getTransactions).not.toHaveBeenCalled();
    });

    it("guest_crm:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/guests/g1/loyalty/transactions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(loyaltyService.getTransactions).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa tranzaksiyalarni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      loyaltyService.getTransactions.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/guests/g1/loyalty/transactions')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(loyaltyService.getTransactions).toHaveBeenCalledWith('t1', 'g1');
    });
  });

  describe('POST /guests/:guestId/loyalty/adjust', () => {
    it("guest_crm:edit ruxsati bo'lmasa 403 qaytaradi (guest_crm:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:view']),
      );
      await request(app.getHttpServer())
        .post('/guests/g1/loyalty/adjust')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ points: 100, reason: "Tug'ilgan kun sovg'asi" })
        .expect(403);
      expect(loyaltyService.adjustPoints).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ballarni tokendagi userId bilan o'zgartiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['guest_crm:edit']),
      );
      loyaltyService.adjustPoints.mockResolvedValue({ balance: 100 });

      await request(app.getHttpServer())
        .post('/guests/g1/loyalty/adjust')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ points: 100, reason: "Tug'ilgan kun sovg'asi" })
        .expect(201);

      expect(loyaltyService.adjustPoints).toHaveBeenCalledWith(
        't1',
        'g1',
        100,
        "Tug'ilgan kun sovg'asi",
        'u1',
      );
    });
  });
});
