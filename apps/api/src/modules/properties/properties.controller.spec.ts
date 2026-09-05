import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-properties-controller';

// `GET /properties` — eng oddiy himoyalangan route: faqat `JwtAuthGuard`,
// hech qanday `@RequirePermission` yo'q (deyarli har bir modul frontend
// ishlashdan oldin propertyId ro'yxatini bilishi kerak, shuning uchun bu
// ataylab shunday loyihalangan). U yerda tekshiriladigan narsa —
// autentifikatsiya talab qilinishi va javob FAQAT tokendagi tenantId
// bo'yicha filtrlanishi.
//
// Logotip route'lari (PUT/DELETE :propertyId/logo) esa aksincha —
// TENANT_SETTINGS:EDIT ruxsatini talab qiladi va kirish ma'lumoti qattiq
// tekshiriladi (faqat rasm `data:` URL'lari, hajm chegarasi bilan).
describe('PropertiesController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let propertiesService: {
    listByTenant: jest.Mock;
    setLogo: jest.Mock;
    removeLogo: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  // Haqiqiy (juda kichik) 1x1 PNG — DTO regex'i uchun yaroqli data URL.
  const VALID_LOGO =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeAll(async () => {
    propertiesService = {
      listByTenant: jest.fn(),
      setLogo: jest.fn(),
      removeLogo: jest.fn(),
    };
    rolesService = { getEffectivePermissions: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PropertiesController],
      providers: [
        { provide: PropertiesService, useValue: propertiesService },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider(),
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    app = nestApp;
    // main.ts'dagi bilan bir xil sozlama — aks holda Express'ning standart
    // 100KB chegarasi katta so'rovni DTO'ga yetkazmay 413 bilan rad etadi va
    // hajm tekshiruvi (LOGO_MAX_LENGTH) umuman sinovdan o'tmaydi.
    nestApp.useBodyParser('json', { limit: '1mb' });
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

  describe('GET /properties', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).get('/properties').expect(401);
      expect(propertiesService.listByTenant).not.toHaveBeenCalled();
    });

    it("yasama (noto'g'ri imzoli) token bilan 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
      expect(propertiesService.listByTenant).not.toHaveBeenCalled();
    });

    it("to'g'ri token bilan 200 va faqat tokendagi tenantId bo'yicha ro'yxat qaytaradi", async () => {
      propertiesService.listByTenant.mockResolvedValue([
        { id: 'p1', name: 'Bosh bino' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(propertiesService.listByTenant).toHaveBeenCalledWith('t1');
      expect(res.body).toEqual([{ id: 'p1', name: 'Bosh bino' }]);
    });

    it("boshqa tenant tokeni bilan chaqirilsa, o'sha (so'ragan) tenantId uzatiladi — cross-tenant parametr yo'q", async () => {
      propertiesService.listByTenant.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties')
        .set(
          'Authorization',
          `Bearer ${tokenFor({ sub: 'u2', tenantId: 't2', isPlatformAdmin: false })}`,
        )
        .expect(200);

      expect(propertiesService.listByTenant).toHaveBeenCalledWith('t2');
    });
  });

  describe('PUT /properties/:propertyId/logo', () => {
    // TENANT_SETTINGS:EDIT ruxsati bor foydalanuvchi.
    function allowPermission() {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['tenant_settings:edit']),
      );
    }

    it('token bo\'lmasa 401 qaytaradi', async () => {
      await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .send({ logoUrl: VALID_LOGO })
        .expect(401);
      expect(propertiesService.setLogo).not.toHaveBeenCalled();
    });

    it("TENANT_SETTINGS:EDIT ruxsati bo'lmasa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['booking:view']),
      );

      await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ logoUrl: VALID_LOGO })
        .expect(403);

      expect(propertiesService.setLogo).not.toHaveBeenCalled();
    });

    it('rasm bo\'lmagan data URL\'ni rad etadi (masalan HTML)', async () => {
      allowPermission();

      await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ logoUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' })
        .expect(400);

      expect(propertiesService.setLogo).not.toHaveBeenCalled();
    });

    it("tashqi havolani (http URL) rad etadi — faqat data: URL qabul qilinadi", async () => {
      allowPermission();

      await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ logoUrl: 'https://example.com/logo.png' })
        .expect(400);

      expect(propertiesService.setLogo).not.toHaveBeenCalled();
    });

    it('juda katta rasmni rad etadi (hajm chegarasi)', async () => {
      allowPermission();

      const huge = `data:image/png;base64,${'A'.repeat(400_001)}`;
      await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ logoUrl: huge })
        .expect(400);

      expect(propertiesService.setLogo).not.toHaveBeenCalled();
    });

    it("to'g'ri rasm bilan saqlaydi va tokendagi tenantId'ni uzatadi", async () => {
      allowPermission();
      propertiesService.setLogo.mockResolvedValue({
        id: 'p1',
        logoUrl: VALID_LOGO,
      });

      const res = await request(app.getHttpServer())
        .put('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ logoUrl: VALID_LOGO })
        .expect(200);

      expect(propertiesService.setLogo).toHaveBeenCalledWith(
        't1',
        'p1',
        VALID_LOGO,
      );
      expect(res.body.logoUrl).toBe(VALID_LOGO);
    });
  });

  describe('DELETE /properties/:propertyId/logo', () => {
    it("ruxsat bo'lmasa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());

      await request(app.getHttpServer())
        .delete('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);

      expect(propertiesService.removeLogo).not.toHaveBeenCalled();
    });

    it("ruxsat bilan logotipni o'chiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['tenant_settings:edit']),
      );
      propertiesService.removeLogo.mockResolvedValue({
        id: 'p1',
        logoUrl: null,
      });

      await request(app.getHttpServer())
        .delete('/properties/p1/logo')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(propertiesService.removeLogo).toHaveBeenCalledWith('t1', 'p1');
    });
  });
});
