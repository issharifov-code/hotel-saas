import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceTicket,
  MaintenanceTicketPriority,
  MaintenanceTicketStatus,
} from './entities/maintenance-ticket.entity';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { ResolveMaintenanceTicketDto } from './dto/resolve-maintenance-ticket.dto';

const OPEN_TICKET_STATUSES = [
  MaintenanceTicketStatus.OPEN,
  MaintenanceTicketStatus.IN_PROGRESS,
];

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private readonly ticketRepo: Repository<MaintenanceTicket>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
  ) {}

  async listTickets(
    tenantId: string,
    propertyId: string,
    status?: MaintenanceTicketStatus,
  ): Promise<MaintenanceTicket[]> {
    return this.ticketRepo.find({
      where: status
        ? { tenantId, propertyId, status }
        : { tenantId, propertyId },
      relations: { room: { roomType: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findTicketById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { room: { roomType: true } },
    });
    if (!ticket) throw new NotFoundException("Texnik xizmat so'rovi topilmadi");
    return ticket;
  }

  async createTicket(
    tenantId: string,
    propertyId: string,
    dto: CreateMaintenanceTicketDto,
    reportedByUserId: string,
  ): Promise<MaintenanceTicket> {
    const room = await this.roomRepo.findOneBy({
      id: dto.roomId,
      tenantId,
      propertyId,
    });
    if (!room) throw new NotFoundException('Xona topilmadi');

    const ticket = this.ticketRepo.create({
      tenantId,
      propertyId,
      roomId: dto.roomId,
      title: dto.title.trim(),
      description: dto.description ?? null,
      priority: dto.priority ?? MaintenanceTicketPriority.MEDIUM,
      status: MaintenanceTicketStatus.OPEN,
      reportedByUserId,
      assignedToUserId: dto.assignedToUserId ?? null,
    });
    const saved = await this.ticketRepo.save(ticket);

    // Faqat xona hozir AVAILABLE bo'lsa MAINTENANCE holatiga o'tkaziladi —
    // band (OCCUPIED) yoki allaqachon nazoratdan tashqari (OUT_OF_ORDER)
    // xonaning holatini bosib yubormaslik uchun.
    if (room.status === RoomStatus.AVAILABLE) {
      await this.roomRepo.update(
        { id: room.id },
        { status: RoomStatus.MAINTENANCE },
      );
    }
    return saved;
  }

  async start(
    tenantId: string,
    propertyId: string,
    id: string,
    userId: string,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findTicketById(tenantId, propertyId, id);
    if (ticket.status !== MaintenanceTicketStatus.OPEN) {
      throw new ConflictException(
        `Faqat "open" holatidagi so'rovni boshlash mumkin (joriy holat: ${ticket.status})`,
      );
    }
    ticket.status = MaintenanceTicketStatus.IN_PROGRESS;
    ticket.startedAt = new Date();
    if (!ticket.assignedToUserId) ticket.assignedToUserId = userId;
    return this.ticketRepo.save(ticket);
  }

  async resolve(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: ResolveMaintenanceTicketDto,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findTicketById(tenantId, propertyId, id);
    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        `"${ticket.status}" holatidagi so'rovni yakunlab bo'lmaydi`,
      );
    }
    ticket.status = MaintenanceTicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();
    ticket.resolutionNotes = dto.resolutionNotes ?? null;
    const saved = await this.ticketRepo.save(ticket);
    await this.reopenRoomIfClear(tenantId, propertyId, ticket.roomId);
    return saved;
  }

  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findTicketById(tenantId, propertyId, id);
    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        `"${ticket.status}" holatidagi so'rovni bekor qilib bo'lmaydi`,
      );
    }
    ticket.status = MaintenanceTicketStatus.CANCELLED;
    const saved = await this.ticketRepo.save(ticket);
    await this.reopenRoomIfClear(tenantId, propertyId, ticket.roomId);
    return saved;
  }

  // Agar shu xona uchun boshqa ochiq (OPEN/IN_PROGRESS) so'rov qolmagan bo'lsa
  // va xona hali MAINTENANCE holatida bo'lsa (masalan, qo'lda OUT_OF_ORDER
  // qilib qo'yilmagan bo'lsa), uni AVAILABLE holatiga qaytaradi.
  private async reopenRoomIfClear(
    tenantId: string,
    propertyId: string,
    roomId: string,
  ): Promise<void> {
    const stillOpen = await this.ticketRepo.findOne({
      where: [
        { tenantId, propertyId, roomId, status: MaintenanceTicketStatus.OPEN },
        {
          tenantId,
          propertyId,
          roomId,
          status: MaintenanceTicketStatus.IN_PROGRESS,
        },
      ],
    });
    if (stillOpen) return;

    const room = await this.roomRepo.findOneBy({
      id: roomId,
      tenantId,
      propertyId,
    });
    if (room && room.status === RoomStatus.MAINTENANCE) {
      await this.roomRepo.update(
        { id: roomId },
        { status: RoomStatus.AVAILABLE },
      );
    }
  }
}
