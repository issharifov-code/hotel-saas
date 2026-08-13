import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomTypesService } from './room-types.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    private readonly roomTypesService: RoomTypesService,
  ) {}

  async create(tenantId: string, propertyId: string, dto: CreateRoomDto): Promise<Room> {
    // roomType shu tenant/property'ga tegishli ekanini tekshiradi (mavjud bo'lmasa 404 otadi)
    await this.roomTypesService.findById(tenantId, propertyId, dto.roomTypeId);

    const existing = await this.roomRepo.findOneBy({ propertyId, roomNumber: dto.roomNumber });
    if (existing) {
      throw new ConflictException(`"${dto.roomNumber}" raqamli xona allaqachon mavjud`);
    }

    const room = this.roomRepo.create({
      tenantId,
      propertyId,
      roomTypeId: dto.roomTypeId,
      roomNumber: dto.roomNumber.trim(),
      floor: dto.floor ?? null,
      status: RoomStatus.AVAILABLE,
    });
    return this.roomRepo.save(room);
  }

  async listByProperty(tenantId: string, propertyId: string): Promise<Room[]> {
    return this.roomRepo.find({
      where: { tenantId, propertyId },
      relations: { roomType: true },
      order: { roomNumber: 'ASC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { roomType: true },
    });
    if (!room) throw new NotFoundException('Xona topilmadi');
    return room;
  }

  async updateStatus(tenantId: string, propertyId: string, id: string, status: RoomStatus): Promise<Room> {
    const room = await this.findById(tenantId, propertyId, id);
    room.status = status;
    return this.roomRepo.save(room);
  }
}
