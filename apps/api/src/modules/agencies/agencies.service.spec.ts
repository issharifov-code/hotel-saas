import { NotFoundException } from '@nestjs/common';
import { AgenciesService } from './agencies.service';

// AgenciesService — agentlik KARTOCHKASI (CRUD): yaratishda default
// qiymatlar, topilmagan agentlik uchun NotFoundException, update'da faqat
// berilgan maydonlarning o'zgarishi.
//
// Komissiya hisob-kitobi 2026-09-04'dan boshlab bu servisda EMAS —
// `AgencyCommissionsService` ga ko'chirildi (o'sha yerda sinaladi), chunki
// u endi bosh kitobga provodka yozadi.
describe('AgenciesService', () => {
  function createService(
    agency: unknown = { id: 'a1', commissionPct: '10.00' },
  ) {
    const savedAgency = { id: 'a1' };
    const agencyRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(savedAgency),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(agency),
      findOneBy: jest.fn().mockResolvedValue(agency),
    };
    // 2026-09-04: agentlikning KIM ekani profilda — servis yaratishda
    // turagent profilini ochadi yoki mavjudini ulaydi.
    const guestRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: Record<string, unknown>) =>
        Promise.resolve({ ...x, id: 'prof1' }),
      ),
      findOneBy: jest.fn().mockResolvedValue({
        id: 'prof1',
        profileType: 'travel_agent',
      }),
    };
    const service = new AgenciesService(agencyRepo as never, guestRepo as never);
    return { service, agencyRepo, guestRepo };
  }

  it("yaratishda commissionPct berilmasa 10 (default) qo'yiladi, isActive=true", async () => {
    const { service, agencyRepo } = createService();
    await service.create('t1', 'p1', { name: 'ACME Travel' });
    const createdArg = agencyRepo.create.mock.calls[0][0];
    expect(createdArg.commissionPct).toBe('10');
    expect(createdArg.isActive).toBe(true);
  });

  it('yaratishda berilgan commissionPct saqlanadi', async () => {
    const { service, agencyRepo } = createService();
    await service.create('t1', 'p1', {
      name: 'ACME Travel',
      commissionPct: '15.50',
    });
    expect(agencyRepo.create.mock.calls[0][0].commissionPct).toBe('15.50');
  });

  it('topilmagan agentlik uchun NotFoundException tashlaydi', async () => {
    const { service, agencyRepo } = createService();
    agencyRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('t1', 'p1', 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update — faqat berilgan maydonlarni o'zgartiradi", async () => {
    const { service, agencyRepo } = createService();
    agencyRepo.findOne.mockResolvedValue({
      id: 'a1',
      name: 'ACME Travel',
      commissionPct: '10.00',
      isActive: true,
      // Profil bo'lmasa ham update ishlashi kerak (eski, hali ko'chirilmagan
      // yozuv) — servis `agency.profile` ni shartli tekshiradi.
      profile: null,
    });
    agencyRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

    const result = await service.update('t1', 'p1', 'a1', { isActive: false });
    expect(result).toMatchObject({ isActive: false, name: 'ACME Travel' });
  });


  // 🔬 PROFIL TURI TEKSHIRUVI (2026-09-05, mutatsion sinovda topilgan
  // bo'shliq — CityLedger'dagi bir xil naqsh bilan birga).
  //
  // Agentlik FAQAT "Turagent" turidagi profilga bog'lanadi. Aks holda
  // kompaniya yoki oddiy mehmon profilini agentlik sifatida ulab
  // qo'yish mumkin bo'lardi — va o'sha profilga komissiya hisoblanib,
  // to'lov majburiyati paydo bo'lardi.
  describe('profil turi tekshiruvi', () => {
    it.each([['guest'], ['company'], ['source'], ['group'], ['contact']])(
      "'%s' turidagi profilga agentlik bog'lab bo'lmaydi",
      async (profileType) => {
        const { service, guestRepo, agencyRepo } = createService();
        guestRepo.findOneBy.mockResolvedValue({ id: 'p1', profileType });

        await expect(
          service.create('t1', 'p1', { name: 'ACME', profileId: 'p1' } as never),
        ).rejects.toThrow(/Turagent/);
        expect(agencyRepo.save).not.toHaveBeenCalled();
      },
    );

    it("turagent profiliga bog'lash ishlaydi", async () => {
      const { service, agencyRepo, guestRepo } = createService();

      await service.create('t1', 'p1', { name: 'ACME', profileId: 'prof1' } as never);

      expect(agencyRepo.save).toHaveBeenCalled();
      // Mavjud profil ULANADI — yangisi ochilmaydi.
      expect(guestRepo.save).not.toHaveBeenCalled();
    });

    it("mavjud bo'lmagan profilga bog'lab bo'lmaydi", async () => {
      const { service, guestRepo, agencyRepo } = createService();
      guestRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create('t1', 'p1', { name: 'ACME', profileId: 'yoq' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(agencyRepo.save).not.toHaveBeenCalled();
    });
  });

});
