import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-reports-controller';

describe('ReportsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let reportsService: {
    getOverview: jest.Mock;
    getSegmentPerformance: jest.Mock;
    getGuestRegistrationReport: jest.Mock;
    getBudgetPerformance: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    reportsService = {
      getOverview: jest.fn(),
      getSegmentPerformance: jest.fn(),
      getGuestRegistrationReport: jest.fn(),
      getBudgetPerformance: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
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

  describe('GET /properties/:propertyId/reports/overview', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview')
        .expect(401);
      expect(reportsService.getOverview).not.toHaveBeenCalled();
    });

    it("reports:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(reportsService.getOverview).not.toHaveBeenCalled();
    });

    it("days ko'rsatilmasa standart 30 kun bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getOverview.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getOverview).toHaveBeenCalledWith('t1', 'p1', 30);
    });

    it("days=90 bo'lsa aynan shu qiymat bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getOverview.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview?days=90')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getOverview).toHaveBeenCalledWith('t1', 'p1', 90);
    });

    it("days=9999 bo'lsa 365 bilan cheklanadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getOverview.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview?days=9999')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getOverview).toHaveBeenCalledWith('t1', 'p1', 365);
    });

    it("days=-5 (noto'g'ri qiymat) bo'lsa standart 30ga qaytadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getOverview.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/overview?days=-5')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getOverview).toHaveBeenCalledWith('t1', 'p1', 30);
    });
  });

  // Bu endpoint budjet raqamlarini qaytaradi, ya'ni Budjet sahifasi bilan bir
  // xil darajada nozik — shuning uchun REPORTS emas, ACCOUNTING ruxsati.
  // Aks holda reports:view bor xodim budjetni sahifadan ko'ra olmasa-da,
  // shu endpoint orqali ko'rib olardi.
  describe('GET /properties/:propertyId/reports/budget-performance', () => {
    it("token bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/reports/budget-performance')
        .expect(401);
      expect(reportsService.getBudgetPerformance).not.toHaveBeenCalled();
    });

    it("reports:view yetarli EMAS — accounting:view talab qilinadi (403)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .get('/properties/p1/reports/budget-performance?year=2026')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);

      expect(reportsService.getBudgetPerformance).not.toHaveBeenCalled();
    });

    it('accounting:view bilan ishlaydi', async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      reportsService.getBudgetPerformance.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/budget-performance?year=2026')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getBudgetPerformance).toHaveBeenCalledWith(
        't1',
        'p1',
        2026,
      );
    });

    it("yil ko'rsatilmasa joriy yil ishlatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      reportsService.getBudgetPerformance.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/budget-performance')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getBudgetPerformance).toHaveBeenCalledWith(
        't1',
        'p1',
        new Date().getUTCFullYear(),
      );
    });

    it("ma'nosiz yil berilsa joriy yilga qaytadi (xato o'rniga)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      reportsService.getBudgetPerformance.mockResolvedValue({});

      await request(app.getHttpServer())
        .get('/properties/p1/reports/budget-performance?year=abc')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getBudgetPerformance).toHaveBeenCalledWith(
        't1',
        'p1',
        new Date().getUTCFullYear(),
      );
    });
  });

  describe('GET /properties/:propertyId/reports/segment-performance', () => {
    it("ruxsat bo'lsa segment hisobotini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getSegmentPerformance.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/reports/segment-performance?days=60')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getSegmentPerformance).toHaveBeenCalledWith(
        't1',
        'p1',
        60,
      );
    });
  });

  describe('GET /properties/:propertyId/reports/guest-registration', () => {
    it("ruxsat bo'lsa days va pagination birga to'g'ri uzatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getGuestRegistrationReport.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });

      await request(app.getHttpServer())
        .get(
          '/properties/p1/reports/guest-registration?days=14&page=2&pageSize=20',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getGuestRegistrationReport).toHaveBeenCalledWith(
        't1',
        'p1',
        14,
        { page: 2, pageSize: 20, skip: 20, take: 20 },
      );
    });

    it("query yo'q bo'lsa standart days=30 va pageSize=50 bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getGuestRegistrationReport.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });

      await request(app.getHttpServer())
        .get('/properties/p1/reports/guest-registration')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getGuestRegistrationReport).toHaveBeenCalledWith(
        't1',
        'p1',
        30,
        { page: 1, pageSize: 50, skip: 0, take: 50 },
      );
    });
  });
});
