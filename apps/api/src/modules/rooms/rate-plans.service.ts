import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RatePlan } from './entities/rate-plan.entity';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { RoomTypesService } from './room-types.service';

@Injectable()
export class RatePlansService {
  constructor(
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    private readonly roomTypesService: RoomTypesService,
  ) {}

  async create(
    tenantId: string,
    propertyId: string,
    dto: CreateRatePlanDto,
  ): Promise<RatePlan> {
    // roomType shu tenant/property'ga tegishli ekanini tekshiradi (mavjud bo'lmasa 404 otadi)
    await this.roomTypesService.findById(tenantId, propertyId, dto.roomTypeId);

    const ratePlan = this.ratePlanRepo.create({
      tenantId,
      propertyId,
      roomTypeId: dto.roomTypeId,
      name: dto.name.trim(),
      nightlyPrice: dto.nightlyPrice,
      isRefundable: dto.isRefundable ?? true,
      isActive: true,
      description: dto.description ?? null,
      cancellationDeadlineDays: dto.cancellationDeadlineDays ?? null,
      cancellationFeeType: dto.cancellationFeeType ?? null,
      cancellationFeeValue: dto.cancellationFeeValue ?? null,
      noShowFeeType: dto.noShowFeeType ?? null,
      noShowFeeValue: dto.noShowFeeValue ?? null,
    });
    return this.ratePlanRepo.save(ratePlan);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    roomTypeId?: string,
  ): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({
      where: roomTypeId
        ? { tenantId, propertyId, roomTypeId }
        : { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<RatePlan> {
    const ratePlan = await this.ratePlanRepo.findOneBy({
      id,
      tenantId,
      propertyId,
    });
    if (!ratePlan) throw new NotFoundException('Narx rejasi topilmadi');
    return ratePlan;
  }

  // Bir nechta narx rejasini BITTA so'rovda (WHERE id IN (...)) yuklaydi —
  // Night Audit kabi joylarda har bir bron uchun alohida `findById` chaqirish
  // o'rniga ishlatiladi. `findById`dan farqli o'laroq topilmagan ID'lar
  // xatolik tashlamaydi — natijaviy ro'yxatda shunchaki yo'q bo'ladi
  // (chaqiruvchi buni "narx rejasi yo'q" holati sifatida talqin qiladi).
  async findByIds(
    tenantId: string,
    propertyId: string,
    ids: string[],
  ): Promise<RatePlan[]> {
    if (ids.length === 0) return [];
    return this.ratePlanRepo.find({
      where: { id: In(ids), tenantId, propertyId },
    });
  }

  async update(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateRatePlanDto,
  ): Promise<RatePlan> {
    const ratePlan = await this.findById(tenantId, propertyId, id);
    if (dto.name !== undefined) ratePlan.name = dto.name.trim();
    if (dto.nightlyPrice !== undefined)
      ratePlan.nightlyPrice = dto.nightlyPrice;
    if (dto.isRefundable !== undefined)
      ratePlan.isRefundable = dto.isRefundable;
    if (dto.isActive !== undefined) ratePlan.isActive = dto.isActive;
    if (dto.description !== undefined) ratePlan.description = dto.description;
    if (dto.cancellationDeadlineDays !== undefined) {
      ratePlan.cancellationDeadlineDays = dto.cancellationDeadlineDays;
    }
    if (dto.cancellationFeeType !== undefined) {
      ratePlan.cancellationFeeType = dto.cancellationFeeType;
    }
    if (dto.cancellationFeeValue !== undefined) {
      ratePlan.cancellationFeeValue = dto.cancellationFeeValue;
    }
    if (dto.noShowFeeType !== undefined) {
      ratePlan.noShowFeeType = dto.noShowFeeType;
    }
    if (dto.noShowFeeValue !== undefined) {
      ratePlan.noShowFeeValue = dto.noShowFeeValue;
    }
    return this.ratePlanRepo.save(ratePlan);
  }
}
