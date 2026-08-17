import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatePlan } from './entities/rate-plan.entity';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { RoomTypesService } from './room-types.service';

@Injectable()
export class RatePlansService {
  constructor(
    @InjectRepository(RatePlan) private readonly ratePlanRepo: Repository<RatePlan>,
    private readonly roomTypesService: RoomTypesService,
  ) {}

  async create(tenantId: string, propertyId: string, dto: CreateRatePlanDto): Promise<RatePlan> {
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
    });
    return this.ratePlanRepo.save(ratePlan);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    roomTypeId?: string,
  ): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({
      where: roomTypeId ? { tenantId, propertyId, roomTypeId } : { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<RatePlan> {
    const ratePlan = await this.ratePlanRepo.findOneBy({ id, tenantId, propertyId });
    if (!ratePlan) throw new NotFoundException('Narx rejasi topilmadi');
    return ratePlan;
  }

  async update(tenantId: string, propertyId: string, id: string, dto: UpdateRatePlanDto): Promise<RatePlan> {
    const ratePlan = await this.findById(tenantId, propertyId, id);
    if (dto.name !== undefined) ratePlan.name = dto.name.trim();
    if (dto.nightlyPrice !== undefined) ratePlan.nightlyPrice = dto.nightlyPrice;
    if (dto.isRefundable !== undefined) ratePlan.isRefundable = dto.isRefundable;
    if (dto.isActive !== undefined) ratePlan.isActive = dto.isActive;
    if (dto.description !== undefined) ratePlan.description = dto.description;
    return this.ratePlanRepo.save(ratePlan);
  }
}
