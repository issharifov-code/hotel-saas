import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Agency } from './entities/agency.entity';
import { Guest, ProfileType } from '../guests/entities/guest.entity';
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
    // Agentlikning KIM ekani shu yerda (profil) — `GuestsService` emas,
    // to'g'ridan-to'g'ri repository: GuestsModule'ni import qilish aylanma
    // bog'liqlik yaratardi (Guests -> Bookings -> ... ), va bu yerda faqat
    // oddiy o'qish/yozish kerak, mehmon mantig'i emas.
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
  ) {}

  // Berilgan profil shu tenantga tegishli va TURAGENT ekanini tekshiradi.
  // Aks holda kompaniya yoki mehmon profilini agentlik sifatida ulab
  // qo'yish mumkin bo'lardi.
  private async assertTravelAgentProfile(
    tenantId: string,
    profileId: string,
  ): Promise<void> {
    const profile = await this.guestRepo.findOneBy({ id: profileId, tenantId });
    if (!profile) throw new NotFoundException('Profil topilmadi');
    if (profile.profileType !== ProfileType.TRAVEL_AGENT) {
      throw new BadRequestException(
        "Agentlik faqat 'Turagent' turidagi profilga bog'lanadi",
      );
    }
  }

  // Ikki yo'l bilan yaratiladi (2026-09-04):
  //   1) `profileId` berilsa — MAVJUD turagent profili ulanadi. Aynan shu
  //      takrorlanishni yo'q qilish uchun: "Silk Road Tours" allaqachon
  //      profil sifatida bor bo'lsa, uni qayta yozish shart emas.
  //   2) `profileId` berilmasa — nom/aloqadan yangi turagent profili
  //      ochiladi. Eski chaqiruvchilar (mavjud UI) shu yo'l bilan ishlaydi.
  async create(tenantId: string, propertyId: string, dto: CreateAgencyDto): Promise<Agency> {
    let profileId = dto.profileId;
    if (profileId) {
      await this.assertTravelAgentProfile(tenantId, profileId);
    } else {
      const profile = await this.guestRepo.save(
        this.guestRepo.create({
          tenantId,
          profileType: ProfileType.TRAVEL_AGENT,
          fullName: dto.name.trim(),
          phone: dto.contactPhone ?? null,
          email: dto.contactEmail ?? null,
          contactPerson: dto.contactName ?? null,
        }),
      );
      profileId = profile.id;
    }

    const agency = this.agencyRepo.create({
      tenantId,
      propertyId,
      profileId,
      // Eski ustunlar hamon to'ldiriladi — mavjud hisobotlar va tashqi
      // integratsiyalar buzilmasin. Manba esa PROFIL: o'qishda `profile`
      // ustunlik qiladi (`listByProperty`/`findById` uni birga oladi).
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
      relations: { profile: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { profile: true },
    });
    if (!agency) throw new NotFoundException('Agentlik topilmadi');
    return agency;
  }

  async update(tenantId: string, propertyId: string, id: string, dto: UpdateAgencyDto): Promise<Agency> {
    const agency = await this.findById(tenantId, propertyId, id);

    // KIM ekani — profilga. Shu bilan agentlik nomini o'zgartirish uni
    // Profillar sahifasida ham o'zgartiradi (bitta manba).
    const profile = agency.profile;
    if (profile) {
      if (dto.name !== undefined) profile.fullName = dto.name.trim();
      if (dto.contactName !== undefined) profile.contactPerson = dto.contactName;
      if (dto.contactPhone !== undefined) profile.phone = dto.contactPhone;
      if (dto.contactEmail !== undefined) profile.email = dto.contactEmail;
      await this.guestRepo.save(profile);
    }

    // Eski ustunlar ham yangilanadi (yuqoridagi izohga qarang).
    if (dto.name !== undefined) agency.name = dto.name.trim();
    if (dto.contactName !== undefined) agency.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) agency.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) agency.contactEmail = dto.contactEmail;
    // PUL va holat — agentlikda qoladi.
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
