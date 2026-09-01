import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelRoomTypeMapping } from './entities/channel-room-type-mapping.entity';
import {
  ChannelSyncLog,
  ChannelSyncStatus,
} from './entities/channel-sync-log.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import {
  PaginatedResult,
  PaginationParams,
} from '../../common/utils/pagination.util';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { UpsertChannelMappingDto } from './dto/upsert-channel-mapping.dto';
import { RoomTypesService } from '../rooms/room-types.service';
import { RatePlansService } from '../rooms/rate-plans.service';
import { RatePlanRestrictionsService } from '../rooms/rate-plan-restrictions.service';
import { BookingsService } from '../bookings/bookings.service';
import {
  CHANNEL_ADAPTERS,
  ChannelAdapter,
  ChannelAvailabilityDay,
} from './interfaces/channel-adapter.interface';

// Kanalga bir safar sinxronlashda necha kunlik mavjudlik/narx yuboriladi —
// odatiy OTA calendar ko'rinishiga mos, oddiy sobit qiymat (kelajakda
// sozlanadigan qilish mumkin, lekin hozircha MVP uchun yetarli).
const SYNC_DAYS = 14;

@Injectable()
export class ChannelManagerService {
  private readonly adaptersByProvider: Map<string, ChannelAdapter>;

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(ChannelRoomTypeMapping)
    private readonly mappingRepo: Repository<ChannelRoomTypeMapping>,
    @InjectRepository(ChannelSyncLog)
    private readonly syncLogRepo: Repository<ChannelSyncLog>,
    private readonly roomTypesService: RoomTypesService,
    private readonly ratePlansService: RatePlansService,
    private readonly ratePlanRestrictionsService: RatePlanRestrictionsService,
    private readonly bookingsService: BookingsService,
    @Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[],
  ) {
    this.adaptersByProvider = new Map(adapters.map((a) => [a.provider, a]));
  }

  // ---------- Kanallar (Channels) ----------

  async createChannel(
    tenantId: string,
    propertyId: string,
    dto: CreateChannelDto,
  ): Promise<Channel> {
    const channel = this.channelRepo.create({
      tenantId,
      propertyId,
      name: dto.name.trim(),
      provider: dto.provider,
      externalPropertyId: dto.externalPropertyId ?? null,
      isActive: true,
      lastSyncedAt: null,
    });
    return this.channelRepo.save(channel);
  }

  async listChannels(tenantId: string, propertyId: string): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findChannelById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Channel> {
    const channel = await this.channelRepo.findOneBy({
      id,
      tenantId,
      propertyId,
    });
    if (!channel) throw new NotFoundException('Kanal topilmadi');
    return channel;
  }

  async updateChannel(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateChannelDto,
  ): Promise<Channel> {
    const channel = await this.findChannelById(tenantId, propertyId, id);
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.provider !== undefined) channel.provider = dto.provider;
    if (dto.externalPropertyId !== undefined)
      channel.externalPropertyId = dto.externalPropertyId;
    if (dto.isActive !== undefined) channel.isActive = dto.isActive;
    return this.channelRepo.save(channel);
  }

  // ---------- Xona turi xaritalash (Room Type Mappings) ----------

  async upsertMapping(
    tenantId: string,
    propertyId: string,
    channelId: string,
    roomTypeId: string,
    dto: UpsertChannelMappingDto,
  ): Promise<ChannelRoomTypeMapping> {
    // Kanal shu tenant/property'ga tegishli ekanini tekshiradi (mavjud
    // bo'lmasa 404 otadi).
    await this.findChannelById(tenantId, propertyId, channelId);
    // Xona turi ham shu tenant/property'ga tegishli ekanini tekshiradi.
    await this.roomTypesService.findById(tenantId, propertyId, roomTypeId);

    if (dto.ratePlanId) {
      const ratePlan = await this.ratePlansService.findById(
        tenantId,
        propertyId,
        dto.ratePlanId,
      );
      if (ratePlan.roomTypeId !== roomTypeId) {
        throw new BadRequestException(
          'Tanlangan narx rejasi bu xona turiga tegishli emas',
        );
      }
    }

    let mapping = await this.mappingRepo.findOneBy({ channelId, roomTypeId });
    if (!mapping) {
      mapping = this.mappingRepo.create({ channelId, roomTypeId });
    }
    if (dto.ratePlanId !== undefined) mapping.ratePlanId = dto.ratePlanId;
    if (dto.externalRoomTypeId !== undefined)
      mapping.externalRoomTypeId = dto.externalRoomTypeId;
    if (dto.isActive !== undefined) mapping.isActive = dto.isActive;
    return this.mappingRepo.save(mapping);
  }

  async listMappings(
    tenantId: string,
    propertyId: string,
    channelId: string,
  ): Promise<ChannelRoomTypeMapping[]> {
    await this.findChannelById(tenantId, propertyId, channelId);
    return this.mappingRepo.find({
      where: { channelId },
      order: { createdAt: 'ASC' },
    });
  }

  // ---------- Sinxronlash (Sync) ----------

  async listSyncLogs(
    tenantId: string,
    propertyId: string,
    channelId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ChannelSyncLog>> {
    await this.findChannelById(tenantId, propertyId, channelId);
    const [items, total] = await this.syncLogRepo.findAndCount({
      where: { channelId },
      order: { syncedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  // Kanalga bog'langan barcha faol xona turlari uchun keyingi SYNC_DAYS kun
  // bo'yicha mavjud xonalar soni va narxni hisoblab, adapter orqali
  // "yuboradi" (hozircha mock). Har bir xona turi uchun narx: ratePlanId
  // berilgan bo'lsa shu rejaning nightlyPrice'i, aks holda RoomType.basePrice.
  // Agar shu sanada bog'langan narx rejasi uchun Stop Sell qo'yilgan bo'lsa
  // (Rate Plan Restrictions moduli), haqiqiy sondan qat'i nazar 0 ta bo'sh
  // xona yuboriladi — kanal orqali haddan tashqari bron (overbooking)ning
  // oldini olish uchun.
  async syncChannel(
    tenantId: string,
    propertyId: string,
    channelId: string,
  ): Promise<ChannelSyncLog> {
    const channel = await this.findChannelById(tenantId, propertyId, channelId);
    const mappings = await this.mappingRepo.find({
      where: { channelId, isActive: true },
    });

    if (mappings.length === 0) {
      throw new BadRequestException(
        "Kanalga hech qanday faol xona turi bog'lanmagan — avval xaritalash (mapping) qo'shing",
      );
    }

    const startDate = new Date().toISOString().slice(0, 10);
    const days: ChannelAvailabilityDay[] = [];

    for (const mapping of mappings) {
      // Narx manbasi mapping darajasida sobit — kun sikli ichida takroran
      // so'ralmaydi (14 marta bir xil so'rovni takrorlamaslik uchun).
      const price = mapping.ratePlanId
        ? (
            await this.ratePlansService.findById(
              tenantId,
              propertyId,
              mapping.ratePlanId,
            )
          ).nightlyPrice
        : (
            await this.roomTypesService.findById(
              tenantId,
              propertyId,
              mapping.roomTypeId,
            )
          ).basePrice;

      for (let i = 0; i < SYNC_DAYS; i++) {
        const date = this.addDaysIso(startDate, i);
        const nextDate = this.addDaysIso(date, 1);
        let availableRooms =
          await this.bookingsService.countAvailableRoomsOfType(
            tenantId,
            propertyId,
            mapping.roomTypeId,
            date,
            nextDate,
          );

        if (mapping.ratePlanId) {
          const restriction = await this.ratePlanRestrictionsService.getForDate(
            mapping.ratePlanId,
            date,
          );
          if (restriction?.stopSell) availableRooms = 0;
        }

        days.push({
          date,
          externalRoomTypeId: mapping.externalRoomTypeId ?? mapping.roomTypeId,
          availableRooms,
          price,
        });
      }
    }

    const adapter = this.adaptersByProvider.get('mock');
    if (!adapter) {
      throw new BadRequestException('Kanal sinxronlash adapteri topilmadi');
    }
    const result = await adapter.pushAvailability({ channel, days });

    const log = this.syncLogRepo.create({
      channelId,
      syncedAt: new Date(),
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.FAILED,
      roomTypesSynced: mappings.length,
      daysSynced: SYNC_DAYS,
      summary: `${mappings.length} ta xona turi, ${SYNC_DAYS} kun uchun mavjudlik/narx yuborildi`,
      providerRef: result.success ? result.providerRef : null,
      failureReason: result.success
        ? null
        : (result.failureReason ?? "Noma'lum xato"),
    });
    const savedLog = await this.syncLogRepo.save(log);

    channel.lastSyncedAt = new Date();
    await this.channelRepo.save(channel);

    return savedLog;
  }

  private addDaysIso(dateIso: string, days: number): string {
    const d = new Date(`${dateIso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
