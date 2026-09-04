import { GuestsService } from './guests.service';
import { ProfileType } from './entities/guest.entity';

// Profil qidiruvi (2026-09-04, OPERA Cloud "Manage Profile" referensi).
//
// Bu yerda SQL emas, `QueryBuilder`ga uzatilgan shartlar tekshiriladi:
// maqsad — qaysi maydon qaysi ustunga tushishi va bo'sh qiymatlar
// shart QO'SHMASLIGI. Haqiqiy SQL bajarilishi TypeORM zimmasida.
describe('GuestsService.list — qidiruv maydonlari', () => {
  function createService() {
    const calls: { sql: string; params: Record<string, unknown> }[] = [];
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn((sql: string, params: Record<string, unknown>) => {
        calls.push({ sql, params });
        return qb;
      }),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const guestRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new GuestsService(
      guestRepo as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn() } as never,
    );
    return { service, calls, qb };
  }

  it('hech qanday filtr berilmasa qo\'shimcha shart qo\'ymaydi', async () => {
    const { service, calls } = createService();
    await service.list('t1');
    expect(calls).toHaveLength(0);
  });

  it('bo\'sh va faqat probeldan iborat qiymatlar E\'TIBORGA OLINMAYDI', async () => {
    // Aks holda foydalanuvchi maydonni tozalagach ham "%%" bo'yicha
    // qidiruv ketardi va natija sababsiz cheklanardi.
    const { service, calls } = createService();
    await service.list('t1', { name: '', communication: '   ', documentNumber: undefined });
    expect(calls).toHaveLength(0);
  });

  it('ism faqat full_name ustuni bo\'yicha qidiradi', async () => {
    const { service, calls } = createService();
    await service.list('t1', { name: 'Ali' });
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('full_name');
    expect(calls[0].params).toEqual({ name: '%Ali%' });
  });

  it('aloqa maydoni telefon VA email ustunlarini birga qamraydi', async () => {
    // OPERA'da ham bitta "Email / Fax / Phone / Web" katakchasi bor —
    // reception qaysi kanal ekanini emas, faqat qiymatni biladi.
    const { service, calls } = createService();
    await service.list('t1', { communication: '998' });
    expect(calls[0].sql).toContain('phone');
    expect(calls[0].sql).toContain('email');
    expect(calls[0].params).toEqual({ comm: '%998%' });
  });

  it('hujjat va fuqarolik o\'z ustunlariga tushadi', async () => {
    const { service, calls } = createService();
    await service.list('t1', { documentNumber: 'AA12', nationality: 'UZ' });
    expect(calls.map((c) => c.sql).join(' ')).toContain('document_number');
    expect(calls.map((c) => c.sql).join(' ')).toContain('nationality');
  });

  it('bir nechta maydon VA (AND) bilan birlashadi', async () => {
    // Har bir to'ldirilgan maydon natijani TORAYTIRADI (OR emas) —
    // aks holda bitta maydonni to'ldirish natijani kengaytirib yuborardi.
    const { service, calls, qb } = createService();
    await service.list('t1', { name: 'Ali', nationality: 'UZ' });
    expect(calls).toHaveLength(2);
    expect(qb.andWhere).toHaveBeenCalledTimes(2);
  });

  it('eski umumiy `search` maydoni ishlashda davom etadi', async () => {
    // Boshqa sahifalar (masalan bron yaratish) hali shuni ishlatadi.
    const { service, calls } = createService();
    await service.list('t1', { search: 'Aliyev' });
    expect(calls[0].sql).toContain('full_name');
    expect(calls[0].sql).toContain('phone');
    expect(calls[0].params).toEqual({ search: '%Aliyev%' });
  });

  it('qiymat chetidagi probellar kesiladi', async () => {
    const { service, calls } = createService();
    await service.list('t1', { name: '  Ali  ' });
    expect(calls[0].params).toEqual({ name: '%Ali%' });
  });

  describe('profil turi filtri', () => {
    it("tur berilmasa BARCHA turlar qaytadi", async () => {
      // Profillar sahifasining standarti — "Barchasi". Agar bu yerda
      // jimgina `guest` qo'yib yuborsak, kompaniya profillari sahifada
      // umuman ko'rinmay qolardi.
      const { service, calls } = createService();
      await service.list('t1', {});
      expect(calls).toHaveLength(0);
    });

    it('tur berilsa shu tur bo\'yicha filtrlanadi', async () => {
      const { service, calls } = createService();
      await service.list('t1', { profileType: ProfileType.COMPANY });
      expect(calls).toHaveLength(1);
      expect(calls[0].sql).toContain('profile_type');
      expect(calls[0].params).toEqual({ profileType: 'company' });
    });

    it('tur boshqa filtrlar bilan birga ishlaydi', async () => {
      const { service, calls } = createService();
      await service.list('t1', {
        name: 'Orzu',
        profileType: ProfileType.TRAVEL_AGENT,
      });
      expect(calls).toHaveLength(2);
    });
  });
});
