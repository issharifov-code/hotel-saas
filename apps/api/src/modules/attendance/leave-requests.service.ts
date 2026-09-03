import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LeaveRequest,
  LeaveRequestStatus,
} from './entities/leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    private readonly usersService: UsersService,
  ) {}

  async list(
    tenantId: string,
    propertyId: string,
    filters: { userId?: string; status?: LeaveRequestStatus },
  ): Promise<LeaveRequest[]> {
    // TypeORM `find({ where })` yiqiladi (TypeORMError) agar `where` obyekti
    // ichida `undefined` qiymatli xususiyat bo'lsa — shuning uchun ixtiyoriy
    // filtrlar faqat haqiqatan berilgan bo'lsagina qo'shiladi (masalan
    // `GET /leave-requests` hech qanday query parametrisiz chaqirilsa).
    const where: Record<string, unknown> = { tenantId, propertyId };
    if (filters.userId !== undefined) where.userId = filters.userId;
    if (filters.status !== undefined) where.status = filters.status;

    return this.leaveRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    tenantId: string,
    propertyId: string,
    requestedByUserId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const user = await this.usersService.findById(dto.userId);
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('Xodim topilmadi');
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
      );
    }

    return this.leaveRepo.save(
      this.leaveRepo.create({
        tenantId,
        propertyId,
        userId: dto.userId,
        leaveType: dto.leaveType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason?.trim() || null,
        status: LeaveRequestStatus.PENDING,
        requestedByUserId,
      }),
    );
  }

  private async getPending(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<LeaveRequest> {
    const request = await this.leaveRepo.findOneBy({
      id,
      tenantId,
      propertyId,
    });
    if (!request) throw new NotFoundException("Ta'til so'rovi topilmadi");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(
        "Faqat ko'rib chiqilayotgan (pending) so'rov bo'yicha qaror qabul qilish mumkin",
      );
    }
    return request;
  }

  async approve(
    tenantId: string,
    propertyId: string,
    id: string,
    deciderUserId: string,
    dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const request = await this.getPending(tenantId, propertyId, id);
    request.status = LeaveRequestStatus.APPROVED;
    request.decidedByUserId = deciderUserId;
    request.decidedAt = new Date();
    request.decisionNotes = dto.notes?.trim() || null;
    return this.leaveRepo.save(request);
  }

  async reject(
    tenantId: string,
    propertyId: string,
    id: string,
    deciderUserId: string,
    dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const request = await this.getPending(tenantId, propertyId, id);
    request.status = LeaveRequestStatus.REJECTED;
    request.decidedByUserId = deciderUserId;
    request.decidedAt = new Date();
    request.decisionNotes = dto.notes?.trim() || null;
    return this.leaveRepo.save(request);
  }

  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<LeaveRequest> {
    const request = await this.getPending(tenantId, propertyId, id);
    request.status = LeaveRequestStatus.CANCELLED;
    return this.leaveRepo.save(request);
  }
}
