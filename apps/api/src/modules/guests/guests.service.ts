import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest } from './entities/guest.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    // BookingsModule'ni import qilmasdan, to'g'ridan-to'g'ri entity orqali —
    // InvoicingService'ning Booking'ga bo'lgan munosabati bilan bir xil naqsh
    // (aylanma modul bog'liqligidan qochish uchun: Bookings allaqachon Guests'ga bog'liq).
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(tenantId: string, dto: CreateGuestDto): Promise<Guest> {
    const guest = this.guestRepo.create({
      tenantId,
      fullName: dto.fullName.trim(),
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      nationality: dto.nationality ?? null,
      documentType: dto.documentType ?? null,
      documentNumber: dto.documentNumber ?? null,
    });
    return this.guestRepo.save(guest);
  }

  async list(tenantId: string, search?: string): Promise<Guest[]> {
    const qb = this.guestRepo
      .createQueryBuilder('guest')
      .where('guest.tenant_id = :tenantId', { tenantId })
      .orderBy('guest.created_at', 'DESC');

    if (search) {
      qb.andWhere(
        '(guest.full_name ILIKE :search OR guest.phone ILIKE :search OR guest.email ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }
    return qb.getMany();
  }

  async findById(tenantId: string, id: string): Promise<Guest> {
    const guest = await this.guestRepo.findOneBy({ id, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');
    return guest;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateGuestDto,
  ): Promise<Guest> {
    const guest = await this.findById(tenantId, id);
    if (dto.fullName !== undefined) guest.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) guest.phone = dto.phone || null;
    if (dto.email !== undefined) guest.email = dto.email || null;
    if (dto.nationality !== undefined)
      guest.nationality = dto.nationality || null;
    if (dto.documentType !== undefined)
      guest.documentType = dto.documentType || null;
    if (dto.documentNumber !== undefined)
      guest.documentNumber = dto.documentNumber || null;
    if (dto.dateOfBirth !== undefined)
      guest.dateOfBirth = dto.dateOfBirth || null;
    if (dto.notes !== undefined) guest.notes = dto.notes || null;
    return this.guestRepo.save(guest);
  }

  // CRM uchun mehmonning barcha filiallardagi bronlar tarixi (property/xona bilan birga).
  async getStayHistory(tenantId: string, id: string): Promise<Booking[]> {
    await this.findById(tenantId, id);
    return this.bookingRepo.find({
      where: { tenantId, guestId: id },
      relations: { room: true, property: true },
      order: { checkIn: 'DESC' },
    });
  }
}
