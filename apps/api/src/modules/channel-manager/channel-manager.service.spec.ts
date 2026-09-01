import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelProvider } from './entities/channel.entity';
import { ChannelSyncStatus } from './entities/channel-sync-log.entity';
import type { PushAvailabilityRequest } from './interfaces/channel-adapter.interface';

// ChannelManagerService'ning eng muhim qoidalarini sinaydi: kanal CRUD,
// xaritalash (mapping) validatsiyasi (narx rejasi xona turiga mos kelishi
// shart), va eng muhimi — sinxronlash (syncChannel): mavjudlik/narxni
// to'g'ri hisoblash, Stop Sell cheklovini hurmat qilish, va mock adapter
// orqali muvaffaqiyatli/muvaffaqiyatsiz natijaning jurnalga to'g'ri yozilishi.
describe('ChannelManagerService', () => {
  function createService(opts?: {
    channel?: Partial<{
      id: string;
      tenantId: string;
      propertyId: string;
      isActive: boolean;
    }>;
    mappings?: unknown[];
    roomType?: Partial<{ id: string; basePrice: string }>;
    ratePlan?: Partial<{
      id: string;
      roomTypeId: string;
      nightlyPrice: string;
    }>;
    restriction?: unknown;
    availableRooms?: number;
    pushResult?: unknown;
  }) {
    const channel = {
      id: 'ch1',
      tenantId: 't1',
      propertyId: 'p1',
      name: 'Booking.com — Asosiy',
      provider: ChannelProvider.BOOKING_COM,
      externalPropertyId: null,
      isActive: true,
      lastSyncedAt: null,
      ...opts?.channel,
    };
    const channelRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'ch1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([channel]),
      findOneBy: jest.fn().mockResolvedValue(channel),
    };
    const mappingRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'map-1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue(opts?.mappings ?? []),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const syncLogRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'log-1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    const roomType = { id: 'rt1', basePrice: '350000.00', ...opts?.roomType };
    const ratePlan = {
      id: 'rp1',
      roomTypeId: 'rt1',
      nightlyPrice: '400000.00',
      ...opts?.ratePlan,
    };
    const roomTypesService = {
      findById: jest.fn().mockResolvedValue(roomType),
    };
    const ratePlansService = {
      findById: jest.fn().mockResolvedValue(ratePlan),
    };
    const ratePlanRestrictionsService = {
      getForDate: jest.fn().mockResolvedValue(opts?.restriction ?? null),
    };
    const bookingsService = {
      countAvailableRoomsOfType: jest
        .fn()
        .mockResolvedValue(opts?.availableRooms ?? 3),
    };
    // `lastRequest` orqali so'nggi pushAvailability chaqiruvi argumentini
    // to'g'ri tiplangan holda ushlab olamiz (`.mock.calls[0][0]`ni `any`
    // sifatida o'qishning o'rniga — @typescript-eslint/no-unsafe-* xatolarini
    // oldini olish uchun).
    const mockAdapter = {
      provider: 'mock',
      lastRequest: undefined as PushAvailabilityRequest | undefined,
      pushAvailability: jest.fn((request: PushAvailabilityRequest) => {
        mockAdapter.lastRequest = request;
        return Promise.resolve(
          opts?.pushResult ?? { success: true, providerRef: 'MOCK-SYNC-abc' },
        );
      }),
    };
    const service = new ChannelManagerService(
      channelRepo as never,
      mappingRepo as never,
      syncLogRepo as never,
      roomTypesService as never,
      ratePlansService as never,
      ratePlanRestrictionsService as never,
      bookingsService as never,
      [mockAdapter],
    );
    return {
      service,
      channelRepo,
      mappingRepo,
      syncLogRepo,
      roomTypesService,
      ratePlansService,
      ratePlanRestrictionsService,
      bookingsService,
      mockAdapter,
      channel,
      roomType,
      ratePlan,
    };
  }

  it('createChannel — standart qiymatlar bilan yaratadi', async () => {
    const { service, channelRepo } = createService();
    const result = await service.createChannel('t1', 'p1', {
      name: '  Booking.com  ',
      provider: ChannelProvider.BOOKING_COM,
    });
    expect(channelRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Booking.com',
        isActive: true,
        lastSyncedAt: null,
      }),
    );
    expect(result).toBeDefined();
  });

  it('findChannelById — topilmasa NotFoundException tashlaydi', async () => {
    const { service, channelRepo } = createService();
    channelRepo.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.findChannelById('t1', 'p1', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it("upsertMapping — narx rejasi boshqa xona turiga tegishli bo'lsa BadRequestException tashlaydi", async () => {
    const { service } = createService({ ratePlan: { roomTypeId: 'rt-OTHER' } });
    await expect(
      service.upsertMapping('t1', 'p1', 'ch1', 'rt1', { ratePlanId: 'rp1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("upsertMapping — yangi xaritalashni to'g'ri yaratadi", async () => {
    const { service, mappingRepo } = createService();
    await service.upsertMapping('t1', 'p1', 'ch1', 'rt1', {
      externalRoomTypeId: 'ext-123',
      isActive: true,
    });
    // create() mock reference keladi va service shu obyektni keyin
    // to'g'ridan-to'g'ri mutatsiya qiladi (joyida) — shuning uchun
    // toHaveBeenCalledWith yakuniy (mutatsiyalangan) shaklni tekshiradi.
    expect(mappingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'ch1', roomTypeId: 'rt1' }),
    );
    expect(mappingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ externalRoomTypeId: 'ext-123' }),
    );
  });

  it("syncChannel — faol xaritalash bo'lmasa BadRequestException tashlaydi", async () => {
    const { service } = createService({ mappings: [] });
    await expect(service.syncChannel('t1', 'p1', 'ch1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it("syncChannel — ratePlanId yo'q xaritalash uchun RoomType.basePrice'dan narx oladi va muvaffaqiyatli jurnal yozadi", async () => {
    const { service, mockAdapter, syncLogRepo, channelRepo, channel } =
      createService({
        mappings: [
          {
            channelId: 'ch1',
            roomTypeId: 'rt1',
            ratePlanId: null,
            externalRoomTypeId: null,
          },
        ],
        availableRooms: 5,
      });
    const log = await service.syncChannel('t1', 'p1', 'ch1');

    const pushArg = mockAdapter.lastRequest!;
    expect(pushArg.days).toHaveLength(14);
    expect(pushArg.days[0]).toEqual(
      expect.objectContaining({
        externalRoomTypeId: 'rt1',
        availableRooms: 5,
        price: '350000.00',
      }),
    );
    expect(syncLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ChannelSyncStatus.SUCCESS,
        roomTypesSynced: 1,
        daysSynced: 14,
        providerRef: 'MOCK-SYNC-abc',
      }),
    );
    expect(channelRepo.save).toHaveBeenCalledTimes(1);
    expect(channel.lastSyncedAt).toBeInstanceOf(Date);
    expect(log).toBeDefined();
  });

  it("syncChannel — ratePlanId berilgan xaritalash uchun Stop Sell bo'lsa mavjudlikni 0ga majburlaydi", async () => {
    const { service, mockAdapter } = createService({
      mappings: [
        {
          channelId: 'ch1',
          roomTypeId: 'rt1',
          ratePlanId: 'rp1',
          externalRoomTypeId: null,
        },
      ],
      availableRooms: 7,
      restriction: { stopSell: true },
    });
    await service.syncChannel('t1', 'p1', 'ch1');

    const pushArg = mockAdapter.lastRequest!;
    expect(pushArg.days.every((d) => d.availableRooms === 0)).toBe(true);
    expect(pushArg.days[0].price).toBe('400000.00');
  });

  it("syncChannel — adapter muvaffaqiyatsiz bo'lsa FAILED jurnal yozadi", async () => {
    const { service, syncLogRepo } = createService({
      mappings: [
        {
          channelId: 'ch1',
          roomTypeId: 'rt1',
          ratePlanId: null,
          externalRoomTypeId: null,
        },
      ],
      pushResult: {
        success: false,
        providerRef: '',
        failureReason: 'Tarmoq xatosi',
      },
    });
    await service.syncChannel('t1', 'p1', 'ch1');
    expect(syncLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ChannelSyncStatus.FAILED,
        providerRef: null,
        failureReason: 'Tarmoq xatosi',
      }),
    );
  });
});
