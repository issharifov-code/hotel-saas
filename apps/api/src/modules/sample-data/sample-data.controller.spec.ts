import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { SampleDataController } from './sample-data.controller';
import { SampleDataService } from './sample-data.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-sample-data-controller';

// Namunaviy ma'lumotlarni o'chirish — buzilmas/destruktiv amal, shu sabab
// tenant_settings:delete talab qilinadi (odatda faqat OWNER'ga berilgan).
describe('SampleDataController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let sampleDataService: { removeSampleData: jest.Mock };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    sampleDataService = {
      removeSampleData: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [SampleDataController],
      providers: [
        { provide: SampleDataService, useValue: sampleDataService },
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

  describe('DELETE /sample-data', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer()).delete('/sample-data').expect(401);
      expect(sampleDataService.removeSampleData).not.toHaveBeenCalled();
    });

    it("tenant_settings:delete ruxsati yo'q bo'lsa 403 qaytaradi (edit/create yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['tenant_settings:view', 'tenant_settings:edit']),
      );
      await request(app.getHttpServer())
        .delete('/sample-data')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(sampleDataService.removeSampleData).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa tokendagi tenantId bilan namunaviy ma'lumotlarni o'chiradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['tenant_settings:delete']),
      );
      sampleDataService.removeSampleData.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/sample-data')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(sampleDataService.removeSampleData).toHaveBeenCalledWith('t1');
    });
  });
});
