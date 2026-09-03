import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';

export interface StaffRosterEntry {
  id: string;
  fullName: string;
  salaryType: string | null;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    private readonly usersService: UsersService,
  ) {}

  // Davomat/ta'til sahifalari uchun yengil xodimlar ro'yxati — `GET /users`
  // (USERS_ROLES:view talab qiladi) o'rniga PAYROLL:view bilan himoyalangan
  // (Buxgalter roli USERS_ROLES'ga ega emas, lekin PAYROLL'ga ega — shu
  // sahifalarni ochishi uchun alohida, minimal endpoint kerak). Faqat
  // ism+maosh turi qaytaradi, maosh SUMMASI emas (u alohida, PAYROLL:view'ning
  // o'zi orqali ham ko'rinadi, lekin bu yerda keraksiz).
  async listStaffRoster(tenantId: string): Promise<StaffRosterEntry[]> {
    const users = await this.usersService.listByTenant(tenantId);
    return users
      .filter((u) => u.status === UserStatus.ACTIVE)
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        salaryType: u.salaryType,
      }));
  }

  // Berilgan kun uchun mulkning barcha davomat yozuvlari (kunlik ro'yxat/grid
  // ko'rinishi uchun) — frontend buni faol xodimlar ro'yxati
  // (`listStaffRoster`) bilan birlashtirib, hali yozuv kiritilmagan
  // xodimlarni ham ko'rsatadi.
  async listForDate(
    tenantId: string,
    propertyId: string,
    date: string,
  ): Promise<AttendanceRecord[]> {
    return this.recordRepo.find({
      where: { tenantId, propertyId, date },
      order: { createdAt: 'ASC' },
    });
  }

  // Berilgan davr uchun bitta xodimning davomat tarixi.
  async listForUser(
    tenantId: string,
    propertyId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<AttendanceRecord[]> {
    return this.recordRepo.find({
      where: { tenantId, propertyId, userId, date: Between(from, to) },
      order: { date: 'ASC' },
    });
  }

  // Sana+xodim bo'yicha upsert — mavjud bo'lsa yangilanadi (masalan kun
  // davomida ikki marta to'g'irlansa), bo'lmasa yangi yaratiladi.
  async upsert(
    tenantId: string,
    propertyId: string,
    recordedByUserId: string,
    userId: string,
    date: string,
    dto: UpsertAttendanceDto,
  ): Promise<AttendanceRecord> {
    const user = await this.usersService.findById(userId);
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('Xodim topilmadi');
    }

    let record = await this.recordRepo.findOneBy({ propertyId, userId, date });
    if (!record) {
      record = this.recordRepo.create({ tenantId, propertyId, userId, date });
    }
    record.status = dto.status;
    record.hoursWorked =
      dto.hoursWorked !== undefined ? dto.hoursWorked.toFixed(2) : null;
    record.notes = dto.notes?.trim() || null;
    record.recordedByUserId = recordedByUserId;
    return this.recordRepo.save(record);
  }

  // PayrollService.createRun uchun — berilgan oy ichidagi barcha davomat
  // yozuvlarining hours_worked yig'indisi. Davomat yozuvi umuman bo'lmasa
  // (masalan modul hali ishlatilmagan tenant) — 0 qaytaradi, PayrollService
  // avvalgidek qo'lda kiritishga tayanadi (orqaga moslik).
  async getMonthlyHours(
    tenantId: string,
    propertyId: string,
    userId: string,
    year: number,
    month: number,
  ): Promise<number> {
    if (month < 1 || month > 12) {
      throw new BadRequestException("Oy 1 dan 12 gacha bo'lishi kerak");
    }
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.recordRepo.find({
      where: { tenantId, propertyId, userId, date: Between(from, to) },
    });
    return records.reduce((sum, r) => sum + Number(r.hoursWorked ?? 0), 0);
  }
}
