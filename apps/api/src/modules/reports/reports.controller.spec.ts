import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
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
    getInsights: jest.Mock;
    dismissInsight: jest.Mock;
    restoreInsights: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    reportsService = {
      getOverview: jest.fn(),
      getSegmentPerformance: jest.fn(),
      getGuestRegistrationReport: jest.fn(),
      getBudgetPerformance: jest.fn(),
      getInsights: jest.fn(),
      dismissInsight: jest.fn(),
      restoreInsights: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider(),
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // main.ts bilan bir xil — yopish endpointidagi `severity` validatsiyasi
    // shu pipe orqali ishlaydi.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
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

  // Tavsiyalar paneli: endpoint REPORTS:VIEW bilan ochiladi, LEKIN budjet
  // qismi faqat ACCOUNTING:VIEW ham bo'lsa qo'shiladi (servisga
  // `includeBudget` orqali uzatiladi). Shu ikkisi chalkashib ketmasligi
  // muhim — aks holda budjet reports:view bor har kimga ko'rinardi.
  describe('GET /properties/:propertyId/reports/insights', () => {
    it("token bo'lmasa 401", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/reports/insights')
        .expect(401);
      expect(reportsService.getInsights).not.toHaveBeenCalled();
    });

    it("reports:view bo'lmasa 403", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      await request(app.getHttpServer())
        .get('/properties/p1/reports/insights')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(reportsService.getInsights).not.toHaveBeenCalled();
    });

    it("faqat reports:view bo'lsa budjetsiz chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );
      reportsService.getInsights.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/reports/insights')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getInsights).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        30,
        false,
      );
    });

    it("accounting:view ham bo'lsa budjet bilan chaqiriladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view', 'accounting:view']),
      );
      reportsService.getInsights.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/reports/insights')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(reportsService.getInsights).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        30,
        true,
      );
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

    it('reports:view yetarli EMAS — accounting:view talab qilinadi (403)', async () => {
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
  describe('tavsiyani yopish / qaytarish', () => {
    it("reports:view bo'lmasa yopib bo'lmaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());

      await request(app.getHttpServer())
        .post('/properties/p1/reports/insights/open-maintenance/dismiss')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ severity: 'info' })
        .expect(403);

      expect(reportsService.dismissInsight).not.toHaveBeenCalled();
    });

    it('reports:view yetarli — alohida EDIT ruxsati talab qilinmaydi', async () => {
      // Yopish hech kimning ma'lumotini o'zgartirmaydi, faqat yopgan
      // odamning o'z ko'rinishiga ta'sir qiladi.
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .post('/properties/p1/reports/insights/open-maintenance/dismiss')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ severity: 'warning' })
        .expect(204);

      // 🔴 `userId` tokendan olinadi — mijoz uni o'zi yubora olmaydi,
      // ya'ni boshqa xodim nomidan yopib bo'lmaydi.
      expect(reportsService.dismissInsight).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        'open-maintenance',
        'warning',
      );
    });

    it("noto'g'ri severity rad etiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .post('/properties/p1/reports/insights/open-maintenance/dismiss')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ severity: 'juda-yomon' })
        .expect(400);

      expect(reportsService.dismissInsight).not.toHaveBeenCalled();
    });

    it('severity umuman yuborilmasa ham rad etiladi', async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .post('/properties/p1/reports/insights/open-maintenance/dismiss')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({})
        .expect(400);
    });

    it('insightId bilan bitta tavsiyani qaytaradi', async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .delete(
          '/properties/p1/reports/insights/dismissals?insightId=open-maintenance',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(204);

      expect(reportsService.restoreInsights).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        'open-maintenance',
      );
    });

    it("insightId'siz hammasini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['reports:view']),
      );

      await request(app.getHttpServer())
        .delete('/properties/p1/reports/insights/dismissals')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(204);

      expect(reportsService.restoreInsights).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        undefined,
      );
    });

    it("reports:view bo'lmasa qaytarib ham bo'lmaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());

      await request(app.getHttpServer())
        .delete('/properties/p1/reports/insights/dismissals')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);

      expect(reportsService.restoreInsights).not.toHaveBeenCalled();
    });
  });
});
