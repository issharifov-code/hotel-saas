import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { authStateTestProvider } from '../../common/testing/auth-state.testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesService } from '../roles/roles.service';

const JWT_SECRET = 'test-secret-budgets-controller';

// Budjet — mehmonxonaning moliyaviy maqsadlari, ya'ni tijorat jihatdan nozik.
// Shu sababli bu yerdagi asosiy tekshiruv — ruxsat chegarasi: ACCOUNTING'siz
// (masalan front-desk xodimi) na o'qiy oladi, na yoza oladi.
describe('BudgetsController (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let budgetsService: { listByYear: jest.Mock; upsertYear: jest.Mock };
  let rolesService: {
    getEffectivePermissions: jest.Mock;
    assertPropertyBelongsToTenant: jest.Mock;
  };

  beforeAll(async () => {
    budgetsService = { listByYear: jest.fn(), upsertYear: jest.fn() };
    rolesService = {
      getEffectivePermissions: jest.fn(),
      // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
      // tenantga tegishliligini ham tekshiradi.
      assertPropertyBelongsToTenant: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [BudgetsController],
      providers: [
        { provide: BudgetsService, useValue: budgetsService },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        authStateTestProvider(),
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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

  afterEach(() => jest.clearAllMocks());

  const token = () =>
    jwtService.sign({ sub: 'u1', tenantId: 't1', isPlatformAdmin: false });

  function allow(...perms: string[]) {
    rolesService.getEffectivePermissions.mockResolvedValue(new Set(perms));
  }

  it('token yo\'q bo\'lsa 401', async () => {
    await request(app.getHttpServer())
      .get('/properties/p1/budgets?year=2026')
      .expect(401);
  });

  it("ACCOUNTING:VIEW bo'lmasa o'qiy olmaydi (403)", async () => {
    allow('booking:view', 'front_desk:view');

    await request(app.getHttpServer())
      .get('/properties/p1/budgets?year=2026')
      .set('Authorization', `Bearer ${token()}`)
      .expect(403);

    expect(budgetsService.listByYear).not.toHaveBeenCalled();
  });

  it("ACCOUNTING:VIEW bilan o'qiydi va tokendagi tenantId uzatiladi", async () => {
    allow('accounting:view');
    budgetsService.listByYear.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/properties/p1/budgets?year=2026')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);

    expect(budgetsService.listByYear).toHaveBeenCalledWith('t1', 'p1', 2026);
  });

  it("faqat VIEW bilan yoza olmaydi (403)", async () => {
    allow('accounting:view');

    await request(app.getHttpServer())
      .put('/properties/p1/budgets/2026')
      .set('Authorization', `Bearer ${token()}`)
      .send({ months: [{ month: 1, roomsRevenue: '100' }] })
      .expect(403);

    expect(budgetsService.upsertYear).not.toHaveBeenCalled();
  });

  it('ACCOUNTING:EDIT bilan saqlaydi', async () => {
    allow('accounting:edit');
    budgetsService.upsertYear.mockResolvedValue([]);

    await request(app.getHttpServer())
      .put('/properties/p1/budgets/2026')
      .set('Authorization', `Bearer ${token()}`)
      .send({ months: [{ month: 1, roomsRevenue: '100' }] })
      .expect(200);

    expect(budgetsService.upsertYear).toHaveBeenCalledWith('t1', 'p1', 2026, [
      { month: 1, roomsRevenue: '100' },
    ]);
  });

  it("oy 1-12 dan tashqarida bo'lsa 400", async () => {
    allow('accounting:edit');

    await request(app.getHttpServer())
      .put('/properties/p1/budgets/2026')
      .set('Authorization', `Bearer ${token()}`)
      .send({ months: [{ month: 13, roomsRevenue: '100' }] })
      .expect(400);

    expect(budgetsService.upsertYear).not.toHaveBeenCalled();
  });

  it("raqam bo'lmagan qiymatni rad etadi", async () => {
    allow('accounting:edit');

    await request(app.getHttpServer())
      .put('/properties/p1/budgets/2026')
      .set('Authorization', `Bearer ${token()}`)
      .send({ months: [{ month: 1, roomsRevenue: 'juda-ko\'p' }] })
      .expect(400);

    expect(budgetsService.upsertYear).not.toHaveBeenCalled();
  });

  it("oqilona bo'lmagan yilni rad etadi", async () => {
    allow('accounting:edit');

    await request(app.getHttpServer())
      .put('/properties/p1/budgets/1200')
      .set('Authorization', `Bearer ${token()}`)
      .send({ months: [{ month: 1, roomsRevenue: '100' }] })
      .expect(400);

    expect(budgetsService.upsertYear).not.toHaveBeenCalled();
  });
});
