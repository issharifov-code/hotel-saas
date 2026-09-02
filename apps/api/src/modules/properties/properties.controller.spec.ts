import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const JWT_SECRET = 'test-secret-properties-controller';

// Eng oddiy himoyalangan controller — faqat `JwtAuthGuard`, hech qanday
// `@RequirePermission` yo'q (deyarli har bir modul frontend ishlashdan
// oldin propertyId ro'yxatini bilishi kerak, shuning uchun bu ataylab
// shunday loyihalangan). Shu sababli bu yerda tekshiriladigan yagona narsa
// — autentifikatsiya talab qilinishi va javob FAQAT tokendagi tenantId
// bo'yicha filtrlanishi.
describe('PropertiesController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let propertiesService: { listByTenant: jest.Mock };

  beforeAll(async () => {
    propertiesService = {
      listByTenant: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PropertiesController],
      providers: [
        { provide: PropertiesService, useValue: propertiesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        JwtStrategy,
        JwtAuthGuard,
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
});
