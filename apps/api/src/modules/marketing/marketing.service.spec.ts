import { MarketingService } from './marketing.service';

describe('MarketingService', () => {
  function createService(opts: { existing?: Record<string, unknown> } = {}) {
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
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'req-1', fullName: 'Ali', contacted: false },
        ]),
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
      email: 'nodira@example.com',
      note: "Ertaga qo'ng'iroq qiling",
    });
  });

  it("barcha so'rovlarni yaratilgan vaqti bo'yicha kamayish tartibida qaytaradi", async () => {
    const { service, repo } = createService();
    const result = await service.listDemoRequests();

    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    expect(result).toHaveLength(1);
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
