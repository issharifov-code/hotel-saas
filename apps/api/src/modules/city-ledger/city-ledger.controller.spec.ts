import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { CityLedgerController } from './city-ledger.controller';
import { CityLedgerService } from './city-ledger.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-city-ledger-controller';

// City Ledger / Korporativ hisoblar (Corporate Accounts) — moliyaviy
// xarakterdagi (kredit limiti, hisob-varaq) modul bo'lgani uchun alohida
// PermissionModule yo'q, mavjud INVOICING moduli qayta ishlatiladi.
describe('CityLedgerController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let cityLedgerService: {
    listByProperty: jest.Mock;
    findById: jest.Mock;
    getStatement: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock; assertPropertyBelongsToTenant: jest.Mock };

  beforeAll(async () => {
    cityLedgerService = {
      listByProperty: jest.fn(),
      findById: jest.fn(),
      getStatement: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [CityLedgerController],
      providers: [
        { provide: CityLedgerService, useValue: cityLedgerService },
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

  describe('GET /properties/:propertyId/corporate-accounts', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/corporate-accounts')
        .expect(401);
      expect(cityLedgerService.listByProperty).not.toHaveBeenCalled();
    });

    it("invoicing:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/corporate-accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(cityLedgerService.listByProperty).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa ro'yxatni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      cityLedgerService.listByProperty.mockResolvedValue([{ id: 'ca1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/corporate-accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(cityLedgerService.listByProperty).toHaveBeenCalledWith('t1', 'p1');
    });
  });

  describe('GET /properties/:propertyId/corporate-accounts/:id', () => {
    it("ruxsat bo'lsa hisobni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      cityLedgerService.findById.mockResolvedValue({ id: 'ca1' });

      await request(app.getHttpServer())
        .get('/properties/p1/corporate-accounts/ca1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(cityLedgerService.findById).toHaveBeenCalledWith(
        't1',
        'p1',
        'ca1',
      );
    });
  });

  describe('GET /properties/:propertyId/corporate-accounts/:id/statement', () => {
    it("ruxsat bo'lsa hisob-varaqni qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      cityLedgerService.getStatement.mockResolvedValue({ balance: 0 });

      await request(app.getHttpServer())
        .get('/properties/p1/corporate-accounts/ca1/statement')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(cityLedgerService.getStatement).toHaveBeenCalledWith(
        't1',
        'p1',
        'ca1',
      );
    });
  });

  describe('POST /properties/:propertyId/corporate-accounts', () => {
    it("invoicing:create ruxsati yo'q bo'lsa 403 qaytaradi (invoicing:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/corporate-accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ companyName: 'Acme Corp', creditLimit: 5000000 })
        .expect(403);
      expect(cityLedgerService.create).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa hisob yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:create']),
      );
      cityLedgerService.create.mockResolvedValue({ id: 'ca-new' });

      await request(app.getHttpServer())
        .post('/properties/p1/corporate-accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ companyName: 'Acme Corp', creditLimit: 5000000 })
        .expect(201);

      expect(cityLedgerService.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ companyName: 'Acme Corp' }),
      );
    });
  });

  describe('PATCH /properties/:propertyId/corporate-accounts/:id', () => {
    it("invoicing:edit ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .patch('/properties/p1/corporate-accounts/ca1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ creditLimit: 10000000 })
        .expect(403);
      expect(cityLedgerService.update).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa yangilaydi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['invoicing:edit']),
      );
      cityLedgerService.update.mockResolvedValue({ id: 'ca1' });

      await request(app.getHttpServer())
        .patch('/properties/p1/corporate-accounts/ca1')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ creditLimit: 10000000 })
        .expect(200);

      expect(cityLedgerService.update).toHaveBeenCalledWith(
        't1',
        'p1',
        'ca1',
        expect.objectContaining({ creditLimit: 10000000 }),
      );
    });
  });
});
