import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetMonthDto } from './dto/upsert-budget-year.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
  ) {}

  async listByYear(
    tenantId: string,
    propertyId: string,
    year: number,
  ): Promise<Budget[]> {
    return this.budgetRepo.find({
      where: { tenantId, propertyId, year },
      order: { month: 'ASC' },
    });
  }

  // Butun yilni bitta chaqiruvda saqlaydi. Faqat kelgan oylarga tegadi —
  // yuborilmagan oylar o'zgarishsiz qoladi (UI hamma 12 oyni yuboradi, lekin
  // API qisman yangilashga ham to'sqinlik qilmaydi).
  //
  // Uchala ko'rsatkichi ham bo'sh bo'lgan oy YOZILMAYDI, balki mavjud yozuvi
  // o'chiriladi — aks holda foydalanuvchi maydonlarni tozalaganda bazada
  // ma'nosiz (butunlay bo'sh) qator qolib ketardi.
  async upsertYear(
    tenantId: string,
    propertyId: string,
    year: number,
    months: BudgetMonthDto[],
  ): Promise<Budget[]> {
    const existing = await this.budgetRepo.find({
      where: { tenantId, propertyId, year },
    });
    const byMonth = new Map(existing.map((b) => [b.month, b]));

    for (const input of months) {
      const roomsRevenue = normalize(input.roomsRevenue);
      const occupancyRatePct = normalize(input.occupancyRatePct);
      const adr = normalize(input.adr);

      const row = byMonth.get(input.month);
      const isEmpty =
        roomsRevenue === null && occupancyRatePct === null && adr === null;

      if (isEmpty) {
        if (row) await this.budgetRepo.remove(row);
        continue;
      }

      if (row) {
        row.roomsRevenue = roomsRevenue;
        row.occupancyRatePct = occupancyRatePct;
        row.adr = adr;
        await this.budgetRepo.save(row);
      } else {
        await this.budgetRepo.save(
          this.budgetRepo.create({
            tenantId,
            propertyId,
            year,
            month: input.month,
            roomsRevenue,
            occupancyRatePct,
            adr,
          }),
        );
      }
    }

    return this.listByYear(tenantId, propertyId, year);
  }
}

// `undefined` (maydon umuman yuborilmagan) ham, bo'sh satr ham "qiymat yo'q"
// deb qaraladi — UI bo'sh input uchun '' yuboradi.
function normalize(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}
