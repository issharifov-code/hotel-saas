import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';

// `upsertYear` mantiqiga e'tibor: mavjud oy yangilanadi, yangi oy yaratiladi,
// va uchala ko'rsatkichi ham bo'sh bo'lgan oy YOZILMAYDI (mavjud bo'lsa
// o'chiriladi) — aks holda bazada ma'nosiz bo'sh qatorlar to'planardi.
describe('BudgetsService', () => {
  let service: BudgetsService;
  let repo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((x: unknown) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x: unknown) => x),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getRepositoryToken(Budget), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(BudgetsService);
  });

  it('yangi oy uchun yozuv yaratadi', async () => {
    await service.upsertYear('t1', 'p1', 2026, [
      { month: 3, roomsRevenue: '1000.00', occupancyRatePct: '70', adr: '400' },
    ]);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        propertyId: 'p1',
        year: 2026,
        month: 3,
        roomsRevenue: '1000.00',
        occupancyRatePct: '70',
        adr: '400',
      }),
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('mavjud oyni yangilaydi, yangi yozuv yaratmaydi', async () => {
    const existing = {
      id: 'b1',
      month: 3,
      roomsRevenue: '1',
      occupancyRatePct: '1',
      adr: '1',
    };
    repo.find.mockResolvedValue([existing]);

    await service.upsertYear('t1', 'p1', 2026, [
      { month: 3, roomsRevenue: '2000', occupancyRatePct: '80', adr: '500' },
    ]);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'b1',
        roomsRevenue: '2000',
        occupancyRatePct: '80',
        adr: '500',
      }),
    );
  });

  it("hamma ko'rsatkichi bo'sh oy uchun yozuv yaratmaydi", async () => {
    await service.upsertYear('t1', 'p1', 2026, [
      { month: 5, roomsRevenue: null, occupancyRatePct: null, adr: null },
    ]);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("mavjud oy butunlay bo'shatilsa yozuvni o'chiradi", async () => {
    const existing = { id: 'b1', month: 5 };
    repo.find.mockResolvedValue([existing]);

    await service.upsertYear('t1', 'p1', 2026, [
      { month: 5, roomsRevenue: '', occupancyRatePct: '', adr: '' },
    ]);

    expect(repo.remove).toHaveBeenCalledWith(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("qisman to'ldirilgan oyni qabul qiladi (faqat daromad)", async () => {
    await service.upsertYear('t1', 'p1', 2026, [
      { month: 7, roomsRevenue: '5000' },
    ]);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        month: 7,
        roomsRevenue: '5000',
        occupancyRatePct: null,
        adr: null,
      }),
    );
  });

  it('yuborilmagan oylarga tegmaydi', async () => {
    repo.find.mockResolvedValue([
      { id: 'b1', month: 1, roomsRevenue: '100' },
      { id: 'b2', month: 2, roomsRevenue: '200' },
    ]);

    await service.upsertYear('t1', 'p1', 2026, [
      { month: 1, roomsRevenue: '999' },
    ]);

    // Faqat 1-oy saqlandi, 2-oyga umuman tegilmadi.
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("faqat so'ralgan tenant/mulk/yil bo'yicha qidiradi", async () => {
    await service.listByYear('t1', 'p1', 2026);

    expect(repo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', propertyId: 'p1', year: 2026 },
      order: { month: 'ASC' },
    });
  });
});
