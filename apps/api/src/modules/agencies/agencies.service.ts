import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Agency } from './entities/agency.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

export interface AgencySummary {
  agencyId: string;
  bookingCount: number;
  totalRevenue: string;
  commissionOwed: string;
}

@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(Agency) private readonly agencyRepo: Repository<Agency>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(tenantId: string, propertyId: string, dto: CreateAgencyDto): Promise<Agency> {
    const agency = this.agencyRepo.create({
      tenantId,
      propertyId,
      name: dto.name.trim(),
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,
      commissionPct: dto.commissionPct ?? '10',
      notes: dto.notes ?? null,
      isActive: true,
    });
    return this.agencyRepo.save(agency);
  }

  async listByProperty(tenantId: string, propertyId: string): Promise<Agency[]> {
    return this.agencyRepo.find({
      where: { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Agency> {
    const agency = await this.agencyRepo.findOneBy({ id, tenantId, propertyId });
    if (!agency) throw new NotFoundException('Agentlik topilmadi');
    return agency;
  }

  async update(tenantId: string, propertyId: string, id: string, dto: UpdateAgencyDto): Promise<Agency> {
    const agency = await this.findById(tenantId, propertyId, id);
    if (dto.name !== undefined) agency.name = dto.name.trim();
    if (dto.contactName !== undefined) agency.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) agency.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) agency.contactEmail = dto.contactEmail;
    if (dto.commissionPct !== undefined) agency.commissionPct = dto.commissionPct;
    if (dto.notes !== undefined) agency.notes = dto.notes;
    if (dto.isActive !== undefined) agency.isActive = dto.isActive;
    return this.agencyRepo.save(agency);
  }

  // Faqat-o'qish agregatsiya (ReportsService naqshiga o'xshab) — mavjud
  // Booking.totalAmount yozuvlaridan hisoblanadi, hech qanday accounting
  // provodkasi/yangi yozuv yaratilmaydi. Bekor qilingan bronlar hisobga
  // olinmaydi (haqiqiy tushirilgan daromad emas).
  async getSummary(tenantId: string, propertyId: string, agencyId: string): Promise<AgencySummary> {
    await this.findById(tenantId, propertyId, agencyId); // 404 agar topilmasa

    const bookings = await this.bookingRepo.find({
      where: {
        tenantId,
        propertyId,
        agencyId,
        status: Not(BookingStatus.CANCELLED),
      },
    });

    const agency = await this.agencyRepo.findOneBy({ id: agencyId, tenantId, propertyId });
    const commissionPct = Number(agency?.commissionPct ?? 0);
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const commissionOwed = (totalRevenue * commissionPct) / 100;

    return {
      agencyId,
      bookingCount: bookings.length,
      totalRevenue: totalRevenue.toFixed(2),
      commissionOwed: commissionOwed.toFixed(2),
    };
  }
}
