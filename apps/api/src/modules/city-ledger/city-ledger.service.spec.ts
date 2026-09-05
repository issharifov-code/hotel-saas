import { NotFoundException } from '@nestjs/common';
import { CityLedgerService } from './city-ledger.service';
import { InvoiceStatus } from '../invoicing/entities/invoice.entity';

// CityLedgerService'ning eng muhim qoidalarini sinaydi: yaratishda default
// qiymatlar (paymentTermsDays=30, isActive=true), topilmagan hisob uchun
// NotFoundException, va getStatement'ning hisob-kitobi (bekor qilingan
// hisob-fakturalar hisobga olinmasligi, balans/muddati o'tgan summa to'g'ri
// hisoblanishi).
describe('CityLedgerService', () => {
  function createService(
    invoices: unknown[] = [],
    account: unknown = { id: 'ca1', paymentTermsDays: 30, creditLimit: null },
  ) {
    const savedAccount = { id: 'ca1' };
    const accountRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(savedAccount),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(account),
      findOneBy: jest.fn().mockResolvedValue(account),
    };
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(invoices);
    const invoiceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    // 2026-09-04: hisobning KIM ekani profilda.
    const guestRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: Record<string, unknown>) =>
        Promise.resolve({ ...x, id: 'prof1' }),
      ),
      findOneBy: jest.fn().mockResolvedValue({
        id: 'prof1',
        profileType: 'company',
      }),
    };
    const service = new CityLedgerService(
      accountRepo as never,
      invoiceRepo as never,
      guestRepo as never,
    );
    return { service, accountRepo, invoiceRepo, guestRepo, qb };
  }

  it("yaratishda paymentTermsDays berilmasa 30 (default) qo'yiladi, isActive=true", async () => {
    const { service, accountRepo } = createService();
    await service.create('t1', 'p1', { name: 'Acme LLC' });
    const createdArg = accountRepo.create.mock.calls[0][0];
    expect(createdArg.paymentTermsDays).toBe(30);
    expect(createdArg.isActive).toBe(true);
  });

  it('yaratishda berilgan paymentTermsDays saqlanadi', async () => {
    const { service, accountRepo } = createService();
    await service.create('t1', 'p1', {
      name: 'Acme LLC',
      paymentTermsDays: 15,
    });
    expect(accountRepo.create.mock.calls[0][0].paymentTermsDays).toBe(15);
  });

  it('topilmagan korporativ hisob uchun NotFoundException tashlaydi', async () => {
    const { service, accountRepo } = createService();
    accountRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('t1', 'p1', 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update — faqat berilgan maydonlarni o'zgartiradi", async () => {
    const { service, accountRepo } = createService();
    accountRepo.findOne.mockResolvedValue({
      id: 'ca1',
      name: 'Acme LLC',
      paymentTermsDays: 30,
      isActive: true,
      profile: null,
    });
    accountRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

    const result = await service.update('t1', 'p1', 'ca1', { isActive: false });
    expect(result).toMatchObject({ isActive: false, name: 'Acme LLC' });
  });

  it("getStatement — bekor qilingan hisob-fakturalar so'rovga kiritilmaydi (query darajasida filtrlanadi)", async () => {
    const { service, qb } = createService([], {
      id: 'ca1',
      paymentTermsDays: 30,
      creditLimit: null,
    });
    await service.getStatement('t1', 'p1', 'ca1');
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('invoice.status'),
      expect.objectContaining({ cancelled: InvoiceStatus.CANCELLED }),
    );
  });

  it("getStatement — balans va muddati o'tgan summani to'g'ri hisoblaydi", async () => {
    const now = Date.now();
    const overdueIssuedAt = new Date(now - 40 * 24 * 60 * 60 * 1000); // 40 kun oldin
    const recentIssuedAt = new Date(now - 5 * 24 * 60 * 60 * 1000); // 5 kun oldin
    const invoices = [
      {
        id: 'inv1',
        bookingId: 'b1',
        guest: { fullName: 'John Smith' },
        status: InvoiceStatus.ISSUED,
        totalAmount: '1000000.00',
        paidAmount: '0.00',
        issuedAt: overdueIssuedAt,
      },
      {
        id: 'inv2',
        bookingId: 'b2',
        guest: { fullName: 'Jane Doe' },
        status: InvoiceStatus.ISSUED,
        totalAmount: '500000.00',
        paidAmount: '500000.00',
        issuedAt: recentIssuedAt,
      },
    ];
    const { service } = createService(invoices, {
      id: 'ca1',
      paymentTermsDays: 30,
      creditLimit: '2000000.00',
    });

    const statement = await service.getStatement('t1', 'p1', 'ca1');

    expect(statement.invoiceCount).toBe(2);
    expect(statement.totalCharged).toBe('1500000.00');
    expect(statement.totalPaid).toBe('500000.00');
    expect(statement.totalBalance).toBe('1000000.00');
    // Faqat inv1 (30 kunlik muddatdan o'tgan, balansi bor) muddati o'tgan hisoblanadi
    expect(statement.overdueBalance).toBe('1000000.00');
    expect(statement.lines[0].isOverdue).toBe(true);
    expect(statement.lines[1].isOverdue).toBe(false);
    expect(statement.lines[0].guestName).toBe('John Smith');
  });

  it("getStatement — hisob-fakturalar bo'lmasa 0 qaytaradi", async () => {
    const { service } = createService([], {
      id: 'ca1',
      paymentTermsDays: 30,
      creditLimit: null,
    });
    const statement = await service.getStatement('t1', 'p1', 'ca1');
    expect(statement.invoiceCount).toBe(0);
    expect(statement.totalCharged).toBe('0.00');
    expect(statement.totalBalance).toBe('0.00');
    expect(statement.overdueBalance).toBe('0.00');
  });

  it("getStatement — mavjud bo'lmagan korporativ hisob uchun NotFoundException tashlaydi", async () => {
    const { service, accountRepo } = createService();
    accountRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getStatement('t1', 'p1', 'no-such-id'),
    ).rejects.toThrow(NotFoundException);
  });

  // 🔴 KORPORATIV HISOB FAQAT KOMPANIYA PROFILIGA BOG'LANADI
  // (2026-09-05, mutatsion sinovda topilgan bo'shliq — bu shart hech
  // qanday test bilan qo'riqlanmagan edi).
  //
  // Nima uchun muhim: korporativ hisob — bu "kompaniya bizga qarz"
  // degani. Uni mehmon profiliga yoki turagentga bog'lab qo'yish
  // qarzni noto'g'ri yuzga yozadi, hisobotlar esa jimgina aralashib
  // ketadi (turagent komissiyasi va korporativ qarz butunlay
  // boshqa narsalar).
  describe("profil turi tekshiruvi", () => {
    it("kompaniya bo'lmagan profilga korporativ hisob ochib bo'lmaydi", async () => {
      const { service, guestRepo, accountRepo } = createService();
      guestRepo.findOneBy.mockResolvedValue({ id: 'p1', profileType: 'guest' });

      await expect(
        service.create('t1', 'p1', { name: 'Acme', profileId: 'p1' } as never),
      ).rejects.toThrow(/Kompaniya/);
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it("turagent profiliga ham bog'lab bo'lmaydi", async () => {
      const { service, guestRepo } = createService();
      guestRepo.findOneBy.mockResolvedValue({ id: 'p1', profileType: 'travel_agent' });

      await expect(
        service.create('t1', 'p1', { name: 'Acme', profileId: 'p1' } as never),
      ).rejects.toThrow(/Kompaniya/);
    });

    it("kompaniya profiliga bog'lash ishlaydi", async () => {
      const { service, accountRepo } = createService();

      await service.create('t1', 'p1', { name: 'Acme', profileId: 'prof1' } as never);

      expect(accountRepo.save).toHaveBeenCalled();
    });

    it("mavjud bo'lmagan profilga bog'lab bo'lmaydi", async () => {
      const { service, guestRepo, accountRepo } = createService();
      guestRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create('t1', 'p1', { name: 'Acme', profileId: 'yoq' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(accountRepo.save).not.toHaveBeenCalled();
    });
  });

});
