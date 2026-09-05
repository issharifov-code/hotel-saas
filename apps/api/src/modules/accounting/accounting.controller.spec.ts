import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-accounting-controller';

// Buxgalteriya — pul bilan bog'liq, `accounting:view`/`accounting:create`
// ostida himoyalangan. `listAccounts` boshqa endpointlardan farqli
// o'laroq `propertyId`siz, faqat `tenantId` bilan ishlaydi (hisoblar
// tenant darajasida, property darajasida emas) — bu HTTP darajasida
// alohida tekshiriladi (guard baribir propertyId'ni URL'dan oladi,
// lekin servisga faqat tenantId uzatiladi).
describe('AccountingController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accountingService: {
    listAccounts: jest.Mock;
    listJournalEntries: jest.Mock;
    createManualEntry: jest.Mock;
    getTrialBalance: jest.Mock;
    getIncomeStatement: jest.Mock;
  };
  let rolesService: { getEffectivePermissions: jest.Mock };

  beforeAll(async () => {
    accountingService = {
      listAccounts: jest.fn(),
      listJournalEntries: jest.fn(),
      createManualEntry: jest.fn(),
      getTrialBalance: jest.fn(),
      getIncomeStatement: jest.fn(),
    };
    rolesService = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AccountingController],
      providers: [
        { provide: AccountingService, useValue: accountingService },
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

  describe('GET /properties/:propertyId/accounting/accounts', () => {
    it("Authorization header bo'lmasa 401 qaytaradi", async () => {
      await request(app.getHttpServer())
        .get('/properties/p1/accounting/accounts')
        .expect(401);
      expect(accountingService.listAccounts).not.toHaveBeenCalled();
    });

    it("accounting:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/accounting/accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(accountingService.listAccounts).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa 200 va faqat tenantId bilan (propertyId'siz) so'raladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      accountingService.listAccounts.mockResolvedValue([{ id: 'acc1' }]);

      await request(app.getHttpServer())
        .get('/properties/p1/accounting/accounts')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(rolesService.getEffectivePermissions).toHaveBeenCalledWith(
        't1',
        'u1',
        'p1',
      );
      expect(accountingService.listAccounts).toHaveBeenCalledWith('t1');
    });
  });

  describe('GET /properties/:propertyId/accounting/journal-entries', () => {
    it("accounting:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(accountingService.listJournalEntries).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa filtr query'lari servisga to'g'ri uzatiladi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      accountingService.listJournalEntries.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(
          '/properties/p1/accounting/journal-entries?from=2026-08-01&to=2026-08-31&sourceModule=invoicing',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(accountingService.listJournalEntries).toHaveBeenCalledWith(
        't1',
        'p1',
        { from: '2026-08-01', to: '2026-08-31', sourceModule: 'invoicing' },
      );
    });
  });

  describe('POST /properties/:propertyId/accounting/journal-entries', () => {
    it("accounting:create ruxsati yo'q bo'lsa 403 qaytaradi (accounting:view yetarli emas)", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      await request(app.getHttpServer())
        .post('/properties/p1/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({
          entryDate: '2026-08-25',
          description: 'Ish haqi',
          lines: [
            { accountId: 'acc1', debit: 100 },
            { accountId: 'acc2', credit: 100 },
          ],
        })
        .expect(403);
      expect(accountingService.createManualEntry).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa qo'lda yozuvni tokendagi userId bilan yaratadi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:create']),
      );
      accountingService.createManualEntry.mockResolvedValue({ id: 'je1' });

      const dto = {
        entryDate: '2026-08-25',
        description: 'Ish haqi',
        lines: [
          { accountId: 'acc1', debit: 100 },
          { accountId: 'acc2', credit: 100 },
        ],
      };

      await request(app.getHttpServer())
        .post('/properties/p1/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(dto)
        .expect(201);

      expect(accountingService.createManualEntry).toHaveBeenCalledWith(
        't1',
        'p1',
        'u1',
        expect.objectContaining({ description: 'Ish haqi' }),
      );
    });
  });

  describe('GET /properties/:propertyId/accounting/trial-balance', () => {
    it("accounting:view ruxsati yo'q bo'lsa 403 qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(new Set());
      await request(app.getHttpServer())
        .get('/properties/p1/accounting/trial-balance')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(403);
      expect(accountingService.getTrialBalance).not.toHaveBeenCalled();
    });

    it("ruxsat bo'lsa hisob qoldiqlarini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      accountingService.getTrialBalance.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/properties/p1/accounting/trial-balance?asOfDate=2026-08-25')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(accountingService.getTrialBalance).toHaveBeenCalledWith(
        't1',
        'p1',
        '2026-08-25',
      );
    });
  });

  describe('GET /properties/:propertyId/accounting/income-statement', () => {
    it("ruxsat bo'lsa daromad hisobotini qaytaradi", async () => {
      rolesService.getEffectivePermissions.mockResolvedValue(
        new Set(['accounting:view']),
      );
      accountingService.getIncomeStatement.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(
          '/properties/p1/accounting/income-statement?from=2026-08-01&to=2026-08-31',
        )
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(200);

      expect(accountingService.getIncomeStatement).toHaveBeenCalledWith(
        't1',
        'p1',
        '2026-08-01',
        '2026-08-31',
      );
    });
  });
});
