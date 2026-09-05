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
import { calculateLoyaltyTier, pointsForPayment as computePointsForPayment } from './loyalty-formula.util';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(LoyaltyTransaction)
    private readonly txRepo: Repository<LoyaltyTransaction>,
  ) {}

  // Sof hisob-kitob logikasi `loyalty-formula.util.ts`ga ko'chirildi (SampleDataService
  // ham xuddi shu formuladan, RLS-repository'larsiz, to'g'ridan-to'g'ri import orqali
  // foydalanishi uchun) — bu ikki metod orqaga moslik uchun shu yerda qoldirilgan (mavjud
  // chaqiruvchilar, masalan GuestsService.mergeGuests, o'zgarishsiz ishlayveradi).
  calculateTier(lifetimePoints: number): LoyaltyTier {
    return calculateLoyaltyTier(lifetimePoints);
  }

  pointsForPayment(amount: string | number): number {
    return computePointsForPayment(amount);
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
    // 🔴 QATOR QULFI (2026-09-05, integratsion testda topilgan nuqson).
    //
    // Bu metod "o'qi — hisobla — mutlaq qiymatni yoz" naqshida ishlaydi.
    // Qulfsiz ikki so'rov bir vaqtda BIR XIL boshlang'ich qiymatni
    // o'qiydi va ikkinchisi birinchisining natijasini bosib ketadi
    // ("lost update"). Bu ataylab sinaldi va oqibati og'ir edi:
    //
    //   * bir vaqtda 5 ta "+10" yuborilganda qoldiq 50 emas, 30 bo'ldi
    //     (20 ball yo'qoldi — mehmon zarar ko'radi);
    //   * qoldiq 100 bo'lganda bir vaqtda 5 ta "−80" yuborilganda
    //     TO'RTTASI o'tib ketdi (mehmonxona 320 ball qiymatini berib,
    //     atigi 80 ni ayirdi).
    //
    // `pessimistic_write` — bu qatorni o'zgartirmoqchi bo'lgan boshqa
    // tranzaksiya shu tranzaksiya tugagunicha KUTADI, ya'ni bir mehmon
    // uchun ball o'zgarishlari ketma-ket bajariladi. So'rov allaqachon
    // RLS interceptor tranzaksiyasi ichida bo'lgani uchun qulf so'rov
    // oxirigacha ushlab turiladi.
    //
    // NEGA ATOMIK `UPDATE ... SET points = points + :delta` EMAS.
    // U faqat qoldiqni to'g'rilardi, lekin bu yerda `lifetimePoints`
    // va undan hosil bo'ladigan `loyaltyTier` ham yangilanadi — daraja
    // hisobi JS'da (`calculateTier`). Qulf ikkalasini ham bir yo'la
    // himoya qiladi va mavjud mantiqni o'zgartirmaydi.
    const guest = await this.guestRepo
      .createQueryBuilder('guest')
      .setLock('pessimistic_write')
      .where('guest.id = :guestId', { guestId })
      .andWhere('guest.tenant_id = :tenantId', { tenantId })
      .getOne();
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
