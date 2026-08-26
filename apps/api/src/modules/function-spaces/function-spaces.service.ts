import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FunctionSpace } from './entities/function-space.entity';
import {
  FunctionSpaceBooking,
  FunctionSpaceBookingStatus,
} from './entities/function-space-booking.entity';
import { CreateFunctionSpaceDto } from './dto/create-function-space.dto';
import { UpdateFunctionSpaceDto } from './dto/update-function-space.dto';
import { CreateFunctionSpaceBookingDto } from './dto/create-function-space-booking.dto';
import { UpdateFunctionSpaceBookingDto } from './dto/update-function-space-booking.dto';

@Injectable()
export class FunctionSpacesService {
  constructor(
    @InjectRepository(FunctionSpace)
    private readonly spaceRepo: Repository<FunctionSpace>,
    @InjectRepository(FunctionSpaceBooking)
    private readonly bookingRepo: Repository<FunctionSpaceBooking>,
  ) {}

  // ---------- Zallar (Function Spaces) ----------

  async createSpace(
    tenantId: string,
    propertyId: string,
    dto: CreateFunctionSpaceDto,
  ): Promise<FunctionSpace> {
    const space = this.spaceRepo.create({
      tenantId,
      propertyId,
      name: dto.name.trim(),
      capacity: dto.capacity,
      dailyRate: dto.dailyRate ?? '0',
      description: dto.description ?? null,
      isActive: true,
    });
    return this.spaceRepo.save(space);
  }

  async listSpaces(
    tenantId: string,
    propertyId: string,
  ): Promise<FunctionSpace[]> {
    return this.spaceRepo.find({
      where: { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findSpaceById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<FunctionSpace> {
    const space = await this.spaceRepo.findOneBy({ id, tenantId, propertyId });
    if (!space) throw new NotFoundException('Tadbir zali topilmadi');
    return space;
  }

  async updateSpace(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateFunctionSpaceDto,
  ): Promise<FunctionSpace> {
    const space = await this.findSpaceById(tenantId, propertyId, id);
    if (dto.name !== undefined) space.name = dto.name.trim();
    if (dto.capacity !== undefined) space.capacity = dto.capacity;
    if (dto.dailyRate !== undefined) space.dailyRate = dto.dailyRate;
    if (dto.description !== undefined) space.description = dto.description;
    if (dto.isActive !== undefined) space.isActive = dto.isActive;
    return this.spaceRepo.save(space);
  }

  // ---------- Tadbir bronlari (Bookings) ----------

  async listBookings(
    tenantId: string,
    propertyId: string,
    filters: { functionSpaceId?: string } = {},
  ): Promise<FunctionSpaceBooking[]> {
    return this.bookingRepo.find({
      where: {
        tenantId,
        propertyId,
        ...(filters.functionSpaceId
          ? { functionSpaceId: filters.functionSpaceId }
          : {}),
      },
      relations: { functionSpace: true },
      order: { startTime: 'ASC' },
    });
  }

  async findBookingById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<FunctionSpaceBooking> {
    const booking = await this.bookingRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { functionSpace: true },
    });
    if (!booking) throw new NotFoundException('Tadbir bronini topilmadi');
    return booking;
  }

  async createBooking(
    tenantId: string,
    propertyId: string,
    dto: CreateFunctionSpaceBookingDto,
  ): Promise<FunctionSpaceBooking> {
    if (new Date(dto.endTime) <= new Date(dto.startTime)) {
      throw new ConflictException(
        "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak",
      );
    }
    // Zal shu tenant/property'ga tegishli ekanini tasdiqlaydi (404 bo'lmasa).
    await this.findSpaceById(tenantId, propertyId, dto.functionSpaceId);

    const status = dto.status ?? FunctionSpaceBookingStatus.CONFIRMED;
    if (status !== FunctionSpaceBookingStatus.CANCELLED) {
      await this.assertSpaceAvailable(
        dto.functionSpaceId,
        tenantId,
        propertyId,
        dto.startTime,
        dto.endTime,
      );
    }

    const booking = this.bookingRepo.create({
      tenantId,
      propertyId,
      functionSpaceId: dto.functionSpaceId,
      eventName: dto.eventName.trim(),
      organizerName: dto.organizerName.trim(),
      organizerPhone: dto.organizerPhone ?? null,
      organizerEmail: dto.organizerEmail ?? null,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      attendeeCount: dto.attendeeCount ?? null,
      setupStyle: dto.setupStyle ?? null,
      status,
      totalAmount: dto.totalAmount ?? null,
      notes: dto.notes ?? null,
    });
    return this.bookingRepo.save(booking);
  }

  async updateBooking(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateFunctionSpaceBookingDto,
  ): Promise<FunctionSpaceBooking> {
    const booking = await this.findBookingById(tenantId, propertyId, id);

    const functionSpaceId = dto.functionSpaceId ?? booking.functionSpaceId;
    const startTime = dto.startTime ?? booking.startTime.toISOString();
    const endTime = dto.endTime ?? booking.endTime.toISOString();
    const status = dto.status ?? booking.status;

    if (new Date(endTime) <= new Date(startTime)) {
      throw new ConflictException(
        "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak",
      );
    }
    if (dto.functionSpaceId !== undefined) {
      await this.findSpaceById(tenantId, propertyId, dto.functionSpaceId);
    }

    const timeOrSpaceChanged =
      dto.functionSpaceId !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined;
    if (
      status !== FunctionSpaceBookingStatus.CANCELLED &&
      (timeOrSpaceChanged || dto.status !== undefined)
    ) {
      await this.assertSpaceAvailable(
        functionSpaceId,
        tenantId,
        propertyId,
        startTime,
        endTime,
        booking.id,
      );
    }

    if (dto.functionSpaceId !== undefined)
      booking.functionSpaceId = dto.functionSpaceId;
    if (dto.eventName !== undefined) booking.eventName = dto.eventName.trim();
    if (dto.organizerName !== undefined)
      booking.organizerName = dto.organizerName.trim();
    if (dto.organizerPhone !== undefined)
      booking.organizerPhone = dto.organizerPhone;
    if (dto.organizerEmail !== undefined)
      booking.organizerEmail = dto.organizerEmail;
    if (dto.startTime !== undefined)
      booking.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) booking.endTime = new Date(dto.endTime);
    if (dto.attendeeCount !== undefined)
      booking.attendeeCount = dto.attendeeCount;
    if (dto.setupStyle !== undefined) booking.setupStyle = dto.setupStyle;
    if (dto.status !== undefined) booking.status = dto.status;
    if (dto.totalAmount !== undefined) booking.totalAmount = dto.totalAmount;
    if (dto.notes !== undefined) booking.notes = dto.notes;

    return this.bookingRepo.save(booking);
  }

  // Vaqt oralig'i to'qnashuvi: mavjud.start < yangi.end VA mavjud.end > yangi.start
  // (Bookings.findConflictingBooking bilan bir xil naqsh, faqat sana o'rniga
  // timestamp ustunlar bilan).
  private async assertSpaceAvailable(
    functionSpaceId: string,
    tenantId: string,
    propertyId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ): Promise<void> {
    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .where('b.function_space_id = :functionSpaceId', { functionSpaceId })
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.property_id = :propertyId', { propertyId })
      .andWhere('b.status != :cancelled', {
        cancelled: FunctionSpaceBookingStatus.CANCELLED,
      })
      .andWhere('b.start_time < :endTime', { endTime })
      .andWhere('b.end_time > :startTime', { startTime });

    if (excludeBookingId) {
      qb.andWhere('b.id != :excludeBookingId', { excludeBookingId });
    }

    const conflict = await qb.getOne();
    if (conflict) {
      throw new ConflictException(
        "Zal shu vaqt oralig'ida band (boshqa tadbir bilan to'qnashadi)",
      );
    }
  }
}
