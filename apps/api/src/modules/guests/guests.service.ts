import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest } from './entities/guest.entity';
import { CreateGuestDto } from './dto/create-guest.dto';

@Injectable()
export class GuestsService {
  constructor(@InjectRepository(Guest) private readonly guestRepo: Repository<Guest>) {}

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
      qb.andWhere('(guest.full_name ILIKE :search OR guest.phone ILIKE :search OR guest.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    return qb.getMany();
  }

  async findById(tenantId: string, id: string): Promise<Guest> {
    const guest = await this.guestRepo.findOneBy({ id, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');
    return guest;
  }
}
