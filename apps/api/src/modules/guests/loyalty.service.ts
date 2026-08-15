import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest, LoyaltyTier } from './entities/guest.entity';
import {
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from './entities/loyalty-transaction.entity';

// Daraja bo'sag'alari — `lifetimePoints` (umr bo'yi to'plangan, hech qachon kamaymaydigan)
// asosida. Eng yuqoridan pastga tekshiriladi. Kelajakda tenant-sozlanadigan qilish mumkin,
// hozircha butun platforma uchun bitta standart.
const TIER_THRESHOLDS: Array<[LoyaltyTier, number]> = [
  [LoyaltyTier.PLATINUM, 15000],
  [LoyaltyTier.GOLD, 5000],
  [LoyaltyTier.SILVER, 1000],
  [LoyaltyTier.BRONZE, 0],
];

// 1 ball = 10 valyuta birligi (to'lov summasi asosida) — sodda, tenant-sozlanadigan
// bo'lishi kelajakda mumkin (hozircha butun platforma uchun bitta qoida).
const POINTS_PER_CURRENCY_UNIT = 0.1;

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(LoyaltyTransaction)
    private readonly txRepo: Repository<LoyaltyTransaction>,
  ) {}

  calculateTier(lifetimePoints: number): LoyaltyTier {
    for (const [tier, threshold] of TIER_THRESHOLDS) {
      if (lifetimePoints >= threshold) return tier;
    }
    return LoyaltyTier.BRONZE;
  }

  pointsForPayment(amount: string | number): number {
    return Math.floor(Number(amount) * POINTS_PER_CURRENCY_UNIT);
  }

  // Barcha ball o'zgarishlari shu yagona yo'l orqali o'tadi — Guest.loyaltyPoints/
  // lifetimePoints/loyaltyTier'ni yangilaydi VA audit uchun LoyaltyTransaction yozadi.
  // Hech qachon to'g'ridan-to'g'ri guestRepo.save() bilan ball o'zgartirilmasligi kerak.
  private async applyPointsChange(
    tenantId: string,
    guestId: string,
    delta: number,
    type: LoyaltyTransactionType,
    reason: string,
    opts?: { relatedInvoiceId?: string; createdByUserId?: string },
  ): Promise<Guest> {
    const guest = await this.guestRepo.findOneBy({ id: guestId, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');

    const newBalance = guest.loyaltyPoints + delta;
    if (newBalance < 0) {
      throw new BadRequestException(
        "Ball qoldig'i manfiy bo'lishi mumkin emas",
      );
    }

    guest.loyaltyPoints = newBalance;
    if (delta > 0) {
      // Faqat musbat o'zgarish umr bo'yi jamg'armaga (va shu orqali darajaga) qo'shiladi —
      // redeem/manfiy adjust darajani pasaytirmaydi (standart loyalty dasturi qoidasi).
      guest.lifetimePoints += delta;
      guest.loyaltyTier = this.calculateTier(guest.lifetimePoints);
    }
    const savedGuest = await this.guestRepo.save(guest);

    await this.txRepo.save(
      this.txRepo.create({
        guestId,
        type,
        points: delta,
        reason,
        relatedInvoiceId: opts?.relatedInvoiceId ?? null,
        createdByUserId: opts?.createdByUserId ?? null,
      }),
    );

    return savedGuest;
  }

  // InvoicingService.addPayment orqali chaqiriladi — har bir qabul qilingan to'lovdan
  // ball hisoblanadi. guestId bo'lmasa (masalan mehmonsiz hisob-faktura) jim o'tkazib yuboriladi.
  async awardPointsForPayment(
    tenantId: string,
    guestId: string | null | undefined,
    amount: string,
    invoiceId: string,
  ): Promise<void> {
    if (!guestId) return;
    const points = this.pointsForPayment(amount);
    if (points <= 0) return;
    await this.applyPointsChange(
      tenantId,
      guestId,
      points,
      LoyaltyTransactionType.EARN,
      "To'lov uchun ballar",
      {
        relatedInvoiceId: invoiceId,
      },
    );
  }

  // Xodim tomonidan qo'lda tuzatish — musbat (bonus/kompensatsiya) yoki manfiy (xato tuzatish).
  async adjustPoints(
    tenantId: string,
    guestId: string,
    points: number,
    reason: string,
    userId: string,
  ): Promise<Guest> {
    if (!points)
      throw new BadRequestException("Ball miqdori 0 bo'lishi mumkin emas");
    return this.applyPointsChange(
      tenantId,
      guestId,
      points,
      LoyaltyTransactionType.ADJUST,
      reason,
      {
        createdByUserId: userId,
      },
    );
  }

  async getTransactions(
    tenantId: string,
    guestId: string,
  ): Promise<LoyaltyTransaction[]> {
    const guest = await this.guestRepo.findOneBy({ id: guestId, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');
    return this.txRepo.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }
}
