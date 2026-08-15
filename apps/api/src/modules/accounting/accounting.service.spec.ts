import { BadRequestException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

// Bu testlar AccountingService.postJournalEntry — buxgalteriya tizimining eng
// muhim invarianti — ikki tomonlama yozuv qoidasini (debet jami = kredit jami,
// har bir qator faqat bittasiga ega) tekshiradi. Haqiqiy DB o'rniga qatorlar
// bazaga yozilishidan OLDIN sodir bo'ladigan validatsiya xatolarini sinaydi —
// shuning uchun repo'lar to'liq real bo'lishi shart emas, faqat muvaffaqiyatli
// holat uchun minimal mock kifoya.
describe('AccountingService.postJournalEntry', () => {
  function createService() {
    // manager.getRepository(...) faqat muvaffaqiyatli (balanslangan) holatda
    // chaqiriladi — create/save'ni chain qiladigan minimal mock.
    const fakeLineRepo = { create: (l: unknown) => l };
    const savedEntry = { id: 'entry-1' };
    const fakeEntryRepo: {
      create: (data: unknown) => unknown;
      save: jest.Mock;
      manager: { getRepository: jest.Mock };
    } = {
      create: (data: unknown) => data,
      save: jest.fn().mockResolvedValue(savedEntry),
      manager: { getRepository: jest.fn() },
    };
    // postJournalEntry ichida ham entryRepo, ham lineRepo manager.getRepository
    // orqali olinadi — ikkalasi ham entryRepo.manager'dan keladi (real kodda
    // bir xil so'rov-transaction manager'i). JournalEntry uchun entryRepo'ning
    // o'zi kerak (create+save), boshqa har qanday entity (JournalEntryLine) uchun
    // fakeLineRepo qaytariladi.
    fakeEntryRepo.manager.getRepository.mockImplementation(
      (entity: unknown) => {
        if ((entity as { name?: string })?.name === 'JournalEntry')
          return fakeEntryRepo;
        return fakeLineRepo;
      },
    );

    const accountRepo = {} as never;
    const lineRepo = {} as never;
    const service = new AccountingService(
      accountRepo,
      fakeEntryRepo as never,
      lineRepo,
    );
    return { service, fakeEntryRepo };
  }

  const baseInput = {
    tenantId: 't1',
    propertyId: 'p1',
    description: 'Test yozuvi',
    sourceModule: 'manual' as const,
  };

  it("kamida 2 qatordan kam bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [{ accountId: 'a1', debit: '100' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("bitta qatorda ham debet, ham kredit bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '100', credit: '50' },
          { accountId: 'a2', credit: '100' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("bitta qatorda debet ham, kredit ham 0 bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '0', credit: '0' },
          { accountId: 'a2', credit: '100' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("manfiy summa bo'lsa xato tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '-10' },
          { accountId: 'a2', credit: '10' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("debet jami kredit jamiga teng bo'lmasa xato tashlaydi (balanslanmagan)", async () => {
    const { service } = createService();
    await expect(
      service.postJournalEntry({
        ...baseInput,
        lines: [
          { accountId: 'a1', debit: '100' },
          { accountId: 'a2', credit: '99.5' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("debet jami = kredit jami bo'lsa yozuvni muvaffaqiyatli saqlaydi", async () => {
    const { service, fakeEntryRepo } = createService();
    const result = await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '150.00' },
        { accountId: 'a2', credit: '150.00' },
      ],
    });
    expect(result).toEqual({ id: 'entry-1' });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });

  it('uch qatorli (bitta debet, ikkita kredit) balanslangan yozuvni qabul qiladi', async () => {
    const { service, fakeEntryRepo } = createService();
    await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '100' },
        { accountId: 'a2', credit: '60' },
        { accountId: 'a3', credit: '40' },
      ],
    });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });

  it('kichik yaxlitlash xatosi (<=0.005) tolerantlik doirasida qabul qilinadi', async () => {
    const { service, fakeEntryRepo } = createService();
    await service.postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: 'a1', debit: '100.004' },
        { accountId: 'a2', credit: '100.00' },
      ],
    });
    expect(fakeEntryRepo.save).toHaveBeenCalledTimes(1);
  });
});
