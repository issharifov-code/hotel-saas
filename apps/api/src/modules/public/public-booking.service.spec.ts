import { BadRequestException } from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';
import type { PublicCreateBookingDto } from './dto/public-create-booking.dto';

// Bu servis avval umuman test qilinmagan edi (sayqal auditi, Critical
// topilma) — va u XAVFI ENG YUQORI joy: `public-booking.controller.ts`
// autentifikatsiyasiz (JwtAuthGuard/PermissionsGuard'siz, faqat
// PublicTenantGuard bilan) chaqiriladi, ya'ni istalgan tashqi kishi bu
// endpointlarga murojaat qila oladi. Shu sababli narx hisoblash va
// bo'sh xonalarni filtrlash mantig'ida xatolik bo'lsa, u to'g'ridan-to'g'ri
// tashqariga ochiladi.
describe('PublicBookingService', () => {
  function createService(
    opts: Partial<{
      properties: Array<{
        id: string;
        name: string;
        address: string | null;
        currency: string;
      }>;
      roomTypes: Array<{
        id: string;
        name: string;
        description: string | null;
        maxOccupancy: number;
        basePrice: string;
      }>;
      availableCounts: Record<string, number>;
      ratePlansByRoomType: Record<
        string,
        Array<{
          id: string;
          name: string;
          nightlyPrice: string;
          isRefundable: boolean;
          isActive: boolean;
        }>
      >;
      property: { id: string; currency: string };
      guest: { id: string };
      createdBooking: Record<string, unknown>;
    }> = {},
  ) {
    const propertiesService = {
      listByTenant: jest.fn().mockResolvedValue(opts.properties ?? []),
      findById: jest
        .fn()
        .mockResolvedValue(opts.property ?? { id: 'p1', currency: 'UZS' }),
    };
    const roomTypesService = {
      listByProperty: jest.fn().mockResolvedValue(opts.roomTypes ?? []),
    };
    const ratePlansService = {
      listByProperty: jest
        .fn()
        .mockImplementation((_t: string, _p: string, roomTypeId: string) =>
          Promise.resolve(opts.ratePlansByRoomType?.[roomTypeId] ?? []),
        ),
    };
    const bookingsService = {
      countAvailableRoomsOfType: jest
        .fn()
        .mockImplementation((_t: string, _p: string, roomTypeId: string) =>
          Promise.resolve(opts.availableCounts?.[roomTypeId] ?? 0),
        ),
      createFromWebsite: jest.fn().mockResolvedValue(
        opts.createdBooking ?? {
          id: 'booking-1',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          totalAmount: '400000.00',
          currency: 'UZS',
          status: 'pending',
        },
      ),
    };
    const guestsService = {
      findOrCreateForBooking: jest
        .fn()
        .mockResolvedValue(opts.guest ?? { id: 'guest-1' }),
    };
    const service = new PublicBookingService(
      propertiesService as never,
      roomTypesService as never,
      ratePlansService as never,
      bookingsService as never,
      guestsService as never,
    );
    return {
      service,
      propertiesService,
      roomTypesService,
      ratePlansService,
      bookingsService,
      guestsService,
    };
  }

  describe('listProperties', () => {
    it("faqat mehmonga kerakli maydonlarni qaytaradi (ichki ID'lar yo'q)", async () => {
      const { service } = createService({
        properties: [
          {
            id: 'p1',
            name: 'Orzu Hotel',
            address: 'Namangan',
            currency: 'UZS',
          },
        ],
      });
      const result = await service.listProperties('t1');
      expect(result).toEqual([
        { id: 'p1', name: 'Orzu Hotel', address: 'Namangan', currency: 'UZS' },
      ]);
    });
  });

  describe('getAvailability', () => {
    it('checkIn yoki checkOut berilmasa BadRequestException tashlaydi', async () => {
      const { service } = createService();
      await expect(
        service.getAvailability('t1', 'p1', '', '2026-10-03'),
      ).rejects.toThrow(BadRequestException);
    });

    it("checkOut checkIn dan oldin (yoki teng) bo'lsa BadRequestException tashlaydi", async () => {
      const { service } = createService();
      await expect(
        service.getAvailability('t1', 'p1', '2026-10-03', '2026-10-01'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getAvailability('t1', 'p1', '2026-10-01', '2026-10-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it("boshqa tenant'ning property'siga so'rov yuborilsa xatolikni PropertiesService.findById orqali chetlab o'tmaydi", async () => {
      const { service, propertiesService } = createService();
      propertiesService.findById.mockRejectedValue(
        new Error('property topilmadi yoki boshqa tenantga tegishli'),
      );
      await expect(
        service.getAvailability(
          't1',
          'begona-property',
          '2026-10-01',
          '2026-10-03',
        ),
      ).rejects.toThrow('property topilmadi yoki boshqa tenantga tegishli');
    });

    it("bo'sh xonasi yo'q xona turlarini natijadan chiqarib tashlaydi", async () => {
      const { service } = createService({
        roomTypes: [
          {
            id: 'rt-full',
            name: "To'lgan",
            description: null,
            maxOccupancy: 2,
            basePrice: '400000',
          },
          {
            id: 'rt-free',
            name: "Bo'sh",
            description: null,
            maxOccupancy: 2,
            basePrice: '500000',
          },
        ],
        availableCounts: { 'rt-full': 0, 'rt-free': 3 },
      });
      const result = await service.getAvailability(
        't1',
        'p1',
        '2026-10-01',
        '2026-10-03',
      );
      expect(result).toHaveLength(1);
      expect(result[0].roomTypeId).toBe('rt-free');
      expect(result[0].availableCount).toBe(3);
    });

    it("narxni bazaviy narx va faol rate plan'lar orasidan eng pastini tanlaydi, faol bo'lmagan rate plan'larni chiqarib tashlaydi", async () => {
      const { service } = createService({
        roomTypes: [
          {
            id: 'rt-1',
            name: 'Standard',
            description: null,
            maxOccupancy: 2,
            basePrice: '500000',
          },
        ],
        availableCounts: { 'rt-1': 2 },
        ratePlansByRoomType: {
          'rt-1': [
            {
              id: 'rp-active-cheap',
              name: 'Erta band qilish',
              nightlyPrice: '400000',
              isRefundable: false,
              isActive: true,
            },
            {
              id: 'rp-inactive',
              name: 'Eski taklif',
              nightlyPrice: '100000',
              isRefundable: true,
              isActive: false,
            },
          ],
        },
      });
      const result = await service.getAvailability(
        't1',
        'p1',
        '2026-10-01',
        '2026-10-03',
      );
      // Eng arzon FAOL variant (400000) tanlanishi kerak — nofaol 100000 emas.
      expect(result[0].nightlyPriceFrom).toBe(400000);
      expect(result[0].ratePlans).toEqual([
        {
          id: 'rp-active-cheap',
          name: 'Erta band qilish',
          nightlyPrice: '400000',
          isRefundable: false,
        },
      ]);
    });
  });

  describe('createBooking', () => {
    const baseDto: PublicCreateBookingDto = {
      roomTypeId: 'rt-1',
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
      guestFullName: 'Aziz Karimov',
    };

    it('telefon ham, email ham berilmasa BadRequestException tashlaydi', async () => {
      const { service } = createService();
      await expect(service.createBooking('t1', 'p1', baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('faqat telefon berilsa yetarli (email shart emas)', async () => {
      const { service, guestsService, bookingsService } = createService();
      const result = await service.createBooking('t1', 'p1', {
        ...baseDto,
        guestPhone: '+998901234567',
      });

      expect(guestsService.findOrCreateForBooking).toHaveBeenCalledWith('t1', {
        fullName: 'Aziz Karimov',
        phone: '+998901234567',
        email: null,
      });
      expect(bookingsService.createFromWebsite).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ guestId: 'guest-1', currency: 'UZS' }),
      );
      expect(result).toMatchObject({ id: 'booking-1', status: 'pending' });
    });

    it('mehmon topilmasa yaratadi va xona TURI (aniq xona emas) bilan bron yaratadi', async () => {
      const { service, bookingsService } = createService();
      await service.createBooking('t1', 'p1', {
        ...baseDto,
        guestEmail: 'aziz@example.com',
      });

      expect(bookingsService.createFromWebsite).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ roomTypeId: 'rt-1' }),
      );
    });
  });
});
