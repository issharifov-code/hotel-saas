import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousekeepingTask, HousekeepingTaskStatus } from './entities/housekeeping-task.entity';
import { Room, HousekeepingStatus } from '../rooms/entities/room.entity';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';

const OPEN_TASK_STATUSES = [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS];

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectRepository(HousekeepingTask) private readonly taskRepo: Repository<HousekeepingTask>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
  ) {}

  async listRoomStatuses(tenantId: string, propertyId: string): Promise<Room[]> {
    return this.roomRepo.find({
      where: { tenantId, propertyId },
      relations: { roomType: true },
      order: { roomNumber: 'ASC' },
    });
  }

  async listTasks(tenantId: string, propertyId: string, status?: HousekeepingTaskStatus): Promise<HousekeepingTask[]> {
    return this.taskRepo.find({
      where: status ? { tenantId, propertyId, status } : { tenantId, propertyId },
      relations: { room: { roomType: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findTaskById(tenantId: string, propertyId: string, id: string): Promise<HousekeepingTask> {
    const task = await this.taskRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { room: { roomType: true } },
    });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    return task;
  }

  async createTask(tenantId: string, propertyId: string, dto: CreateHousekeepingTaskDto): Promise<HousekeepingTask> {
    const room = await this.roomRepo.findOneBy({ id: dto.roomId, tenantId, propertyId });
    if (!room) throw new NotFoundException('Xona topilmadi');

    const existingOpen = await this.taskRepo.findOne({
      where: { tenantId, propertyId, roomId: dto.roomId, status: HousekeepingTaskStatus.PENDING },
    });
    if (existingOpen) {
      throw new ConflictException("Bu xona uchun allaqachon kutilayotgan tozalash vazifasi mavjud");
    }

    const task = this.taskRepo.create({
      tenantId,
      propertyId,
      roomId: dto.roomId,
      status: HousekeepingTaskStatus.PENDING,
      assignedToUserId: dto.assignedToUserId ?? null,
      notes: dto.notes ?? null,
    });
    return this.taskRepo.save(task);
  }

  async start(tenantId: string, propertyId: string, id: string, userId: string): Promise<HousekeepingTask> {
    const task = await this.findTaskById(tenantId, propertyId, id);
    if (task.status !== HousekeepingTaskStatus.PENDING) {
      throw new ConflictException(
        `Faqat "pending" holatidagi vazifani boshlash mumkin (joriy holat: ${task.status})`,
      );
    }
    task.status = HousekeepingTaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    if (!task.assignedToUserId) task.assignedToUserId = userId;
    await this.roomRepo.update({ id: task.roomId }, { housekeepingStatus: HousekeepingStatus.IN_PROGRESS });
    return this.taskRepo.save(task);
  }

  async complete(tenantId: string, propertyId: string, id: string): Promise<HousekeepingTask> {
    const task = await this.findTaskById(tenantId, propertyId, id);
    if (task.status !== HousekeepingTaskStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Faqat "in_progress" holatidagi vazifani yakunlash mumkin (joriy holat: ${task.status})`,
      );
    }
    task.status = HousekeepingTaskStatus.DONE;
    task.completedAt = new Date();
    await this.roomRepo.update({ id: task.roomId }, { housekeepingStatus: HousekeepingStatus.CLEAN });
    return this.taskRepo.save(task);
  }

  async inspect(tenantId: string, propertyId: string, id: string, inspectorUserId: string): Promise<HousekeepingTask> {
    const task = await this.findTaskById(tenantId, propertyId, id);
    if (task.status !== HousekeepingTaskStatus.DONE) {
      throw new ConflictException(
        `Faqat "done" holatidagi vazifani tekshirish mumkin (joriy holat: ${task.status})`,
      );
    }
    task.status = HousekeepingTaskStatus.INSPECTED;
    task.inspectedAt = new Date();
    task.inspectedByUserId = inspectorUserId;
    await this.roomRepo.update({ id: task.roomId }, { housekeepingStatus: HousekeepingStatus.INSPECTED });
    return this.taskRepo.save(task);
  }

  async cancel(tenantId: string, propertyId: string, id: string): Promise<HousekeepingTask> {
    const task = await this.findTaskById(tenantId, propertyId, id);
    if (!OPEN_TASK_STATUSES.includes(task.status)) {
      throw new ConflictException(`"${task.status}" holatidagi vazifani bekor qilib bo'lmaydi`);
    }
    task.status = HousekeepingTaskStatus.CANCELLED;
    return this.taskRepo.save(task);
  }

  // BookingsService.checkOut tomonidan chaqiriladi: xonani "iflos" deb belgilaydi
  // va agar ochiq vazifa bo'lmasa, avtomatik navbatga qo'yadi.
  async markDirtyAndQueueTask(tenantId: string, propertyId: string, roomId: string): Promise<void> {
    await this.roomRepo.update({ id: roomId, tenantId, propertyId }, { housekeepingStatus: HousekeepingStatus.DIRTY });

    const existingOpen = await this.taskRepo.findOne({
      where: { tenantId, propertyId, roomId, status: HousekeepingTaskStatus.PENDING },
    });
    if (existingOpen) return;

    const task = this.taskRepo.create({
      tenantId,
      propertyId,
      roomId,
      status: HousekeepingTaskStatus.PENDING,
      notes: "Check-out'dan keyin avtomatik yaratildi",
    });
    await this.taskRepo.save(task);
  }

  // BookingsService.checkIn tomonidan chaqiriladi: xona tozalanmagan bo'lsa check-in bloklanadi.
  async assertRoomCleanForCheckIn(tenantId: string, propertyId: string, roomId: string): Promise<void> {
    const room = await this.roomRepo.findOneBy({ id: roomId, tenantId, propertyId });
    if (!room) return;
    const okStatuses = [HousekeepingStatus.CLEAN, HousekeepingStatus.INSPECTED];
    if (!okStatuses.includes(room.housekeepingStatus)) {
      throw new ConflictException(
        `Xona hali tozalanmagan (holat: ${room.housekeepingStatus}) — avval Housekeeping bo'limida tozalanishi kerak`,
      );
    }
  }
}
