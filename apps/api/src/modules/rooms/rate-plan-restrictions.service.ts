import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { RatePlanRestriction } from './entities/rate-plan-restriction.entity';
import { UpsertRatePlanRestrictionDto } from './dto/upsert-rate-plan-restriction.dto';
import { RatePlansService } from './rate-plans.service';

@Injectable()
export class RatePlanRestrictionsService {
  constructor(
    @InjectRepository(RatePlanRestriction)
    private readonly restrictionRepo: Repository<RatePlanRestriction>,
    private readonly ratePlansService: RatePlansService,
  ) {}

  // Bitta sana uchun cheklovni yaratadi yoki (mavjud bo'lsa) yangilaydi.
  async upsert(
    tenantId: string,
    propertyId: string,
    ratePlanId: string,
    date: string,
    dto: UpsertRatePlanRestrictionDto,
  ): Promise<RatePlanRestriction> {
    // Narx rejasi shu tenant/property'ga tegishli ekanini tekshiradi (mavjud
    // bo'lmasa 404 otadi) — cheklov faqat o'z narx rejasiga qo'yilishi mumkin.
    await this.ratePlansService.findById(tenantId, propertyId, ratePlanId);

    let restriction = await this.restrictionRepo.findOneBy({
      ratePlanId,
      date,
    });
    if (!restriction) {
      restriction = this.restrictionRepo.create({ ratePlanId, date });
    }
    if (dto.closedToArrival !== undefined)
      restriction.closedToArrival = dto.closedToArrival;
    if (dto.closedToDeparture !== undefined)
      restriction.closedToDeparture = dto.closedToDeparture;
    if (dto.stopSell !== undefined) restriction.stopSell = dto.stopSell;
    if (dto.minLengthOfStay !== undefined)
      restriction.minLengthOfStay = dto.minLengthOfStay;
    if (dto.maxLengthOfStay !== undefined)
      restriction.maxLengthOfStay = dto.maxLengthOfStay;
    return this.restrictionRepo.save(restriction);
  }

  async listForRatePlan(
    tenantId: string,
    propertyId: string,
    ratePlanId: string,
    from?: string,
    to?: string,
  ): Promise<RatePlanRestriction[]> {
    await this.ratePlansService.findById(tenantId, propertyId, ratePlanId);
    return this.restrictionRepo.find({
      where:
        from && to ? { ratePlanId, date: Between(from, to) } : { ratePlanId },
      order: { date: 'ASC' },
    });
  }

  // Bron yaratishdan oldin chaqiriladi (BookingsService orqali) — kelish
  // sanasidagi cheklov (Stop Sell/Closed to Arrival/Min-Max LOS) va jo'nab
  // ketish sanasidagi cheklovni (Closed to Departure) tekshiradi. Cheklov
  // qo'yilmagan sanalar uchun yozuv umuman yo'q — bu holatda hech narsa
  // tekshirilmaydi (standart xatti-harakat, orqaga moslik ta'minlangan).
  async assertBookingAllowed(
    ratePlanId: string,
    checkIn: string,
    checkOut: string,
    nights: number,
  ): Promise<void> {
    const arrival = await this.restrictionRepo.findOneBy({
      ratePlanId,
      date: checkIn,
    });
    if (arrival) {
      if (arrival.stopSell) {
        throw new ConflictException(
          'Tanlangan sana uchun bu narx rejasi sotuvdan vaqtincha yopilgan (Stop Sell)',
        );
      }
      if (arrival.closedToArrival) {
        throw new ConflictException(
          "Tanlangan sanada bu narx rejasi bo'yicha kelish (check-in) yopiq (Closed to Arrival)",
        );
      }
      if (arrival.minLengthOfStay && nights < arrival.minLengthOfStay) {
        throw new BadRequestException(
          `Bu narx rejasi uchun tanlangan sanada eng kamida ${arrival.minLengthOfStay} kecha turish talab qilinadi`,
        );
      }
      if (arrival.maxLengthOfStay && nights > arrival.maxLengthOfStay) {
        throw new BadRequestException(
          `Bu narx rejasi uchun tanlangan sanada eng ko'pi ${arrival.maxLengthOfStay} kecha turish ruxsat etilgan`,
        );
      }
    }

    const departure = await this.restrictionRepo.findOneBy({
      ratePlanId,
      date: checkOut,
    });
    if (departure?.closedToDeparture) {
      throw new ConflictException(
        "Tanlangan sanada bu narx rejasi bo'yicha jo'nab ketish (check-out) yopiq (Closed to Departure)",
      );
    }
  }

  // Bitta (ratePlanId, date) juftligi uchun cheklovni qaytaradi (topilmasa
  // null) — Channel Manager sinxronlashda Stop Sell holatini tekshirish
  // uchun ishlatiladi (agar shu sanada Stop Sell qo'yilgan bo'lsa, kanalga
  // 0 ta bo'sh xona yuboriladi, haqiqiy sondan qat'i nazar).
  async getForDate(
    ratePlanId: string,
    date: string,
  ): Promise<RatePlanRestriction | null> {
    return this.restrictionRepo.findOneBy({ ratePlanId, date });
  }
}
