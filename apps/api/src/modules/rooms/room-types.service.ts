import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from './entities/room-type.entity';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectRepository(RoomType) private readonly roomTypeRepo: Repository<RoomType>,
  ) {}

  async create(tenantId: string, propertyId: string, dto: CreateRoomTypeDto): Promise<RoomType> {
    const roomType = this.roomTypeRepo.create({
      tenantId,
      propertyId,
      name: dto.name.trim(),
      basePrice: dto.basePrice,
      maxOccupancy: dto.maxOccupancy ?? 2,
      description: dto.description ?? null,
    });
    return this.roomTypeRepo.save(roomType);
  }

  async listByProperty(tenantId: string, propertyId: string): Promise<RoomType[]> {
    return this.roomTypeRepo.find({
      where: { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<RoomType> {
    const roomType = await this.roomTypeRepo.findOneBy({ id, tenantId, propertyId });
    if (!roomType) throw new NotFoundException('Xona turi topilmadi');
    return roomType;
  }
}
