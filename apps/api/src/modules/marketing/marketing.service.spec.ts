import { MarketingService, normalizePhone } from './marketing.service';

describe('MarketingService', () => {
  function createService(
    opts: {
      existing?: Record<string, unknown>;
      recentDuplicate?: Record<string, unknown> | null;
    } = {},
  ) {
    const saved: Record<string, unknown>[] = [];
    const repo = {
      create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
        id: 'req-1',
        ...data,
      })),
      save: jest.fn().mockImplementation((entity: Record<string, unknown>) => {
        saved.push(entity);
        return Promise.resolve(entity);
      }),
      findAndCount: jest
        .fn()
        .mockResolvedValue([
          [{ id: 'req-1', fullName: 'Ali', contacted: false }],
          1,
        ]),
      // Dedup qidiruvi — standart holatda takror yo'q.
      findOne: jest.fn().mockResolvedValue(opts.recentDuplicate ?? null),
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest
        .fn()
        .mockResolvedValue(opts.existing ?? { id: 'req-1', contacted: true }),
    };
    const service = new MarketingService(repo as never);
    return { service, repo, saved };
  }

  it("yangi demo so'rovni yaratadi va email/note ixtiyoriy bo'lishi mumkin", async () => {
    const { service, repo } = createService();
    const result = await service.createDemoRequest({
      fullName: '  Ali Valiyev  ',
      phone: '+998901234567',
    });

    expect(repo.create).toHaveBeenCalledWith({
      fullName: 'Ali Valiyev',
      phone: '+998901234567',
      phoneNormalized: '901234567',
      email: null,
      note: null,
    });
    expect(result.id).toBe('req-1');
  });

  it("email va notega bo'sh joylarni tozalaydi hamda emailni kichik harfga o'tkazadi", async () => {
    const { service, repo } = createService();
    await service.createDemoRequest({
      fullName: 'Nodira',
      phone: '901112233',
      email: '  NODIRA@Example.com ',
      note: "  Ertaga qo'ng'iroq qiling  ",
    });

    expect(repo.create).toHaveBeenCalledWith({
      fullName: 'Nodira',
      phone: '901112233',
      phoneNormalized: '901112233',
      email: 'nodira@example.com',
      note: "Ertaga qo'ng'iroq qiling",
    });
  });

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M13)
  it('24 soat ichidagi takroriy murojaatda yangi qator ochmaydi', async () => {
    const existingRow = { id: 'req-old', fullName: 'Ali', contacted: false };
    const { service, repo } = createService({ recentDuplicate: existingRow });

    const result = await service.createDemoRequest({
      fullName: 'Ali Valiyev',
      phone: '+998 90 123 45 67',
    });

    // Xato EMAS — mavjud qator jimgina qaytariladi, aks holda xato
    // xabari foydalanuvchini qayta-qayta yuborishga undardi.
    expect(result).toBe(existingRow);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phoneNormalized: '901234567' }),
      }),
    );
  });

  it("so'rovlarni sahifalab qaytaradi", async () => {
    const { service, repo } = createService();
    const result = await service.listDemoRequests('2', '25');

    expect(repo.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 25,
      take: 25,
    });
    expect(result).toEqual({
      items: [{ id: 'req-1', fullName: 'Ali', contacted: false }],
      total: 1,
      page: 2,
      pageSize: 25,
    });
  });

  it('markContacted holatni yangilaydi va yangilangan yozuvni qaytaradi', async () => {
    const { service, repo } = createService({
      existing: { id: 'req-1', contacted: true },
    });
    const result = await service.markContacted('req-1', true);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'req-1' },
      { contacted: true },
    );
    expect(result.contacted).toBe(true);
  });
});

describe('normalizePhone', () => {
  it('bir xil raqamning turli yozuvlarini bitta kalitga keltiradi', () => {
    for (const variant of [
      '+998901234567',
      '998 90 123 45 67',
      '(90) 123-45-67',
      '901234567',
    ]) {
      expect(normalizePhone(variant)).toBe('901234567');
    }
  });

  it('boshqa raqamlarni birlashtirib yubormaydi', () => {
    expect(normalizePhone('901234567')).not.toBe(normalizePhone('901234568'));
  });
});
