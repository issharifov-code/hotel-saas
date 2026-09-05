import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLine, InvoiceLineSource } from './entities/invoice-line.entity';
import {
  InvoicePayment,
  InvoicePaymentMethod,
} from './entities/invoice-payment.entity';
import { AddInvoiceLineDto } from './dto/add-invoice-line.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { AccountingService } from '../accounting/accounting.service';
import { LoyaltyService } from '../guests/loyalty.service';
import {
  PaginatedResult,
  PaginationParams,
} from '../../common/utils/pagination.util';

// InvoicePaymentMethod -> Accounting hisob-kitobi system key (Kassa/Bank/Karta kliringi).
// ONLINE (to'lov shlyuzi) uchun alohida hisob hali ochilmagan — Payme/Click
// kabi provayderlar ham amalda karta/elektron kliring orqali hisoblashadi,
// shuning uchun hozircha 'card_clearing' bilan bir xil hisobga yoziladi.
// Haqiqiy provayder ulanganda, agar kerak bo'lsa, alohida systemKey ajratish mumkin.
const PAYMENT_METHOD_SYSTEM_KEY: Record<InvoicePaymentMethod, string> = {
  [InvoicePaymentMethod.CASH]: 'cash',
  [InvoicePaymentMethod.CARD]: 'card_clearing',
  [InvoicePaymentMethod.BANK_TRANSFER]: 'bank_transfer',
  [InvoicePaymentMethod.ONLINE]: 'card_clearing',
};

@Injectable()
export class InvoicingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
    @InjectRepository(InvoicePayment)
    private readonly paymentRepo: Repository<InvoicePayment>,
    private readonly accountingService: AccountingService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Check-in paytida BookingsService tomonidan chaqiriladi — folio ochiladi va
  // xona narxi birinchi qator sifatida qo'shiladi. Idempotent: agar booking uchun
  // hisob-faktura allaqachon mavjud bo'lsa, o'shani qaytaradi (qayta yaratmaydi).
  async openFolio(
    tenantId: string,
    propertyId: string,
    booking: Booking,
  ): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId: booking.id },
    });
    if (existing) return existing;

    const roomChargeLine = this.lineRepo.create({
      description: `Xona narxi (${booking.checkIn} — ${booking.checkOut})`,
      source: InvoiceLineSource.ROOM_CHARGE,
      quantity: '1',
      unitPrice: booking.totalAmount,
      amount: booking.totalAmount,
    });

    const invoice = this.invoiceRepo.create({
      tenantId,
      propertyId,
      bookingId: booking.id,
      guestId: booking.guestId,
      status: InvoiceStatus.OPEN,
      totalAmount: booking.totalAmount,
      paidAmount: '0.00',
      currency: booking.currency,
      lines: [roomChargeLine],
    });
    const saved = await this.invoiceRepo.save(invoice);

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Xona narxi — bron ${booking.id.slice(0, 8)}`,
      sourceModule: 'invoicing',
      sourceId: saved.id,
      debitSystemKey: 'guest_ledger_ar',
      creditSystemKey: 'room_revenue',
      amount: booking.totalAmount,
    });

    return saved;
  }

  // Bekor qilish (BookingsService.cancel) yoki kelmaslik (NightAuditService no-show)
  // sababli jarima yozish uchun — MUSTAQIL (standalone) hisob-faktura yaratadi.
  // openFolio'dan farqli o'laroq check-in'ga BOG'LIQ EMAS: bekor qilingan/kelmagan
  // bronlarda hech qachon check-in bo'lmaydi, demak openFolio umuman chaqirilmagan
  // bo'ladi — shuning uchun chargeToFolioByBooking (OCHIQ invoice talab qiladi)
  // bu holatda ishlatib bo'lmaydi. Darhol ISSUED holatida yaratiladi (turish hech
  // qachon bo'lmaydi — qo'shimcha qator qo'shilishi kutilmaydi), lekin to'lov
  // qabul qilish (addPayment) hamon mumkin. Idempotent: agar shu booking uchun
  // (masalan qayta urinishda) hisob-faktura allaqachon mavjud bo'lsa, o'shani qaytaradi.
  async createFeeInvoice(
    tenantId: string,
    propertyId: string,
    booking: Booking,
    description: string,
    amount: string,
    creditSystemKey: string,
  ): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId: booking.id },
    });
    if (existing) return existing;

    const feeLine = this.lineRepo.create({
      description,
      source: InvoiceLineSource.CANCELLATION_FEE,
      quantity: '1',
      unitPrice: amount,
      amount,
    });

    const invoice = this.invoiceRepo.create({
      tenantId,
      propertyId,
      bookingId: booking.id,
      guestId: booking.guestId,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
      totalAmount: amount,
      paidAmount: '0.00',
      currency: booking.currency,
      lines: [feeLine],
    });
    const saved = await this.invoiceRepo.save(invoice);

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description,
      sourceModule: 'invoicing',
      sourceId: saved.id,
      debitSystemKey: 'guest_ledger_ar',
      creditSystemKey,
      amount,
    });

    return saved;
  }

  // Check-out paytida BookingsService tomonidan chaqiriladi — folio qat'iylashadi
  // ("issued"). To'lov holati tekshirilmaydi: check-out to'lovdan mustaqil
  // (biznes qoida — tasdiqlangan), to'lanmagan qoldiq keyin kuzatiladi.
  async issueFolio(
    tenantId: string,
    propertyId: string,
    bookingId: string,
  ): Promise<Invoice | null> {
    const invoice = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId },
    });
    if (!invoice || invoice.status !== InvoiceStatus.OPEN)
      return invoice ?? null;

    invoice.status = this.isFullyPaid(invoice)
      ? InvoiceStatus.PAID
      : InvoiceStatus.ISSUED;
    invoice.issuedAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    status: InvoiceStatus | undefined,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Invoice>> {
    const [items, total] = await this.invoiceRepo.findAndCount({
      where: status
        ? { tenantId, propertyId, status }
        : { tenantId, propertyId },
      relations: { booking: { room: true }, guest: true },
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: {
        booking: { room: true },
        guest: true,
        lines: true,
        payments: true,
      },
      order: { lines: { createdAt: 'ASC' }, payments: { createdAt: 'ASC' } },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }

  async findByBooking(
    tenantId: string,
    propertyId: string,
    bookingId: string,
  ): Promise<Invoice | null> {
    const invoice = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId },
    });
    if (!invoice) return null;
    return this.findById(tenantId, propertyId, invoice.id);
  }

  async addLine(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: AddInvoiceLineDto,
  ): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    this.assertChargeable(invoice);

    // 🔴 2026-09-05 (kod auditi): `amount` XOM qiymatlardan hisoblanar,
    // `quantity`/`unitPrice` esa alohida 2 xonaga yaxlitlanib saqlanardi.
    // Natijada foliodagi qator "3 × 1333.33 = 4000.00" ko'rinishida
    // bosilardi (aslida 3999.99) — mehmon uchun bu shunchaki xato hisob.
    // Endi saqlanadigan qiymatlar avval yaxlitlanadi va summa AYNAN
    // ulardan hisoblanadi, ya'ni bosilgan qator har doim o'zaro mos.
    const quantity = Number(dto.quantity.toFixed(2));
    const unitPrice = Number(dto.unitPrice.toFixed(2));
    const amount = (quantity * unitPrice).toFixed(2);
    const savedLine = await this.lineRepo.save(
      this.lineRepo.create({
        invoiceId: invoice.id,
        description: dto.description,
        source: InvoiceLineSource.MANUAL,
        quantity: quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        amount,
      }),
    );

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Qo'shimcha xarajat — ${dto.description}`,
      sourceModule: 'invoicing',
      sourceId: savedLine.id,
      debitSystemKey: 'guest_ledger_ar',
      creditSystemKey: 'other_operated_revenue',
      amount,
    });

    return this.recomputeAndSave(invoice.id);
  }

  // POS'dan "xona hisobiga" to'lovi — faqat folio hali OCHIQ (mehmon hali
  // check-out qilmagan) bo'lsa mumkin.
  async chargeToFolioByBooking(
    tenantId: string,
    propertyId: string,
    bookingId: string,
    description: string,
    amount: string,
    sourceId: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId },
    });
    if (!invoice) {
      throw new ConflictException(
        'Bu bron uchun ochiq hisob-faktura topilmadi (mehmon check-in qilinganmi?)',
      );
    }
    if (invoice.status !== InvoiceStatus.OPEN) {
      throw new ConflictException(
        `Xona hisobiga yozish faqat mehmon joylashgan davrida mumkin (hisob-faktura holati: ${invoice.status})`,
      );
    }

    await this.lineRepo.save(
      this.lineRepo.create({
        invoiceId: invoice.id,
        description,
        source: InvoiceLineSource.POS_ORDER,
        sourceId,
        quantity: '1',
        unitPrice: amount,
        amount,
      }),
    );

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Xona hisobiga yozildi — ${description}`,
      sourceModule: 'invoicing',
      sourceId,
      debitSystemKey: 'guest_ledger_ar',
      creditSystemKey: 'fb_revenue',
      amount,
    });

    return this.recomputeAndSave(invoice.id);
  }

  // Front Desk: xona almashtirish yoki sana o'zgartirish paytida narx farqini
  // (musbat yoki manfiy) folio'ga avtomatik qo'shadi. Faqat folio OCHIQ bo'lsa
  // (mehmon hozir joylashgan) ishlaydi — booking hali check-in qilinmagan bo'lsa,
  // shunchaki booking.totalAmount yangilanadi va bu keyin check-in'da hisobga olinadi.
  async addAdjustmentLine(
    tenantId: string,
    propertyId: string,
    bookingId: string,
    description: string,
    amount: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { tenantId, propertyId, bookingId },
    });
    if (!invoice || invoice.status !== InvoiceStatus.OPEN) {
      throw new ConflictException(
        "Narx farqini hisob-fakturaga yozib bo'lmadi — folio ochiq emas (kutilmagan holat)",
      );
    }

    await this.lineRepo.save(
      this.lineRepo.create({
        invoiceId: invoice.id,
        description,
        source: InvoiceLineSource.ADJUSTMENT,
        quantity: '1',
        unitPrice: amount,
        amount,
      }),
    );

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Narx tuzatishi — ${description}`,
      sourceModule: 'invoicing',
      sourceId: invoice.id,
      debitSystemKey: 'guest_ledger_ar',
      creditSystemKey: 'room_revenue',
      amount,
    });

    return this.recomputeAndSave(invoice.id);
  }

  async addPayment(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: AddPaymentDto,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    return this.persistPayment(tenantId, propertyId, invoice, {
      amount: dto.amount.toFixed(2),
      method: dto.method,
      receivedByUserId: userId,
      notes: dto.notes ?? null,
    });
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). To'lov shlyuziga murojaat
  // QULFDAN OLDIN sodir bo'lardi: `PaymentsService.chargeInvoice` qoldiqni
  // qulflanmagan qatordan o'qib tekshirar, keyin `adapter.charge()` ni
  // chaqirar, va faqat undan keyin `persistPayment` qatorni qulflardi.
  //
  // Baza izchil qolardi (qulf ostidagi qayta tekshiruv ortiqcha to'lovni
  // yozmasdi), LEKIN ikkita bir vaqtdagi so'rov (masalan "To'lash"
  // tugmasini ikki marta bosish) mehmonning kartasidan IKKI MARTA pul
  // yechib, bittasini umuman yozib qo'ymasdi — ya'ni olingan pulning
  // hech qanday izi qolmasdi. Hozircha faqat `mock` adapter ulangani
  // uchun bu latent edi; haqiqiy provayder ulangan zahoti pul yo'qotishga
  // aylanardi.
  //
  // Yechim: qulfni shlyuzga murojaatdan OLDIN olish. Qulf so'rov
  // tranzaksiyasi ichida olinadi va tranzaksiya tugagunicha ushlab
  // turiladi, ya'ni ayni bir hisob-faktura uchun ikkinchi so'rov
  // birinchisi tugagunicha kutadi va keyin yangilangan qoldiqni ko'radi.
  // Bu instansiyalar bo'ylab ham ishlaydi (baza darajasidagi qulf).
  //
  // Narxi: shlyuz chaqiruvi davomida bitta qator qulflanib turadi. Bu
  // ikki marta pul yechilishidan ko'ra ancha arzon.
  async lockInvoiceForPayment(
    tenantId: string,
    propertyId: string,
    invoiceId: string,
    amount: string,
  ): Promise<Invoice> {
    // `findById` tenant/property tegishliligini tekshiradi — qulfdan
    // oldin shu tekshiruv o'tishi shart.
    await this.findById(tenantId, propertyId, invoiceId);

    const locked = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :id', { id: invoiceId })
      .getOne();
    if (!locked) {
      throw new NotFoundException('Hisob-faktura topilmadi');
    }
    if (locked.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        "Bekor qilingan hisob-fakturaga to'lov qo'shib bo'lmaydi",
      );
    }

    const balance = Number(locked.totalAmount) - Number(locked.paidAmount);
    if (Number(amount) > balance + 0.005) {
      throw new ConflictException(
        `To'lov summasi qoldiqdan (${balance.toFixed(2)}) oshib ketmasligi kerak`,
      );
    }
    return locked;
  }

  // Payments moduli (to'lov shlyuzi adapterlari — mock/Payme/Click) orqali
  // muvaffaqiyatli amalga oshirilgan to'lovni yozib qo'yish uchun. Chaqiruvchi
  // (PaymentsService) shlyuzga chindan ham murojaat qilib, natija
  // muvaffaqiyatli bo'lgandan keyingina shu metodni chaqiradi — bu yerda
  // shlyuz bilan bog'liq hech qanday mantiq yo'q, faqat yozuv.
  async recordGatewayPayment(
    tenantId: string,
    propertyId: string,
    invoiceId: string,
    params: { amount: string; provider: string; providerRef: string },
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, invoiceId);
    return this.persistPayment(tenantId, propertyId, invoice, {
      amount: params.amount,
      method: InvoicePaymentMethod.ONLINE,
      receivedByUserId: userId,
      notes: null,
      provider: params.provider,
      providerRef: params.providerRef,
    });
  }

  private async persistPayment(
    tenantId: string,
    propertyId: string,
    invoice: Invoice,
    params: {
      amount: string;
      method: InvoicePaymentMethod;
      receivedByUserId: string;
      notes: string | null;
      provider?: string;
      providerRef?: string;
    },
  ): Promise<Invoice> {
    // Invoice qatorini joriy so'rov tranzaksiyasi ichida bloklab (pessimistic_write),
    // eng so'nggi holatni qayta o'qiymiz — bu (a) qoldiqdan oshiq to'lov yozib
    // qo'yilishining oldini oladi (avval bu yerda umuman tekshiruv yo'q edi — faqat
    // PaymentsService.chargeInvoice'da bor edi, addPayment orqali qo'lda kiritilganda
    // esa hech qanday yuqori chegara tekshirilmasdi), va (b) ikkita bir vaqtdagi
    // to'lov so'rovi (masalan ikki xodim yoki gateway+qo'lda) bir-birini "ko'rmasdan"
    // ikkalasi ham eski qoldiqni tekshirib o'tib ketishi (TOCTOU race) xavfini yopadi.
    const locked = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :id', { id: invoice.id })
      .getOne();
    if (!locked) {
      throw new NotFoundException('Hisob-faktura topilmadi');
    }

    if (locked.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        "Bekor qilingan hisob-fakturaga to'lov qo'shib bo'lmaydi",
      );
    }

    const balance = Number(locked.totalAmount) - Number(locked.paidAmount);
    if (Number(params.amount) > balance + 0.005) {
      throw new ConflictException(
        `To'lov summasi qoldiqdan (${balance.toFixed(2)}) oshib ketmasligi kerak`,
      );
    }

    const savedPayment = await this.paymentRepo.save(
      this.paymentRepo.create({
        invoiceId: invoice.id,
        amount: params.amount,
        method: params.method,
        receivedByUserId: params.receivedByUserId,
        notes: params.notes,
        provider: params.provider ?? null,
        providerRef: params.providerRef ?? null,
      }),
    );

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `To'lov qabul qilindi — hisob-faktura ${invoice.id.slice(0, 8)}`,
      sourceModule: 'invoicing',
      sourceId: savedPayment.id,
      debitSystemKey: PAYMENT_METHOD_SYSTEM_KEY[params.method],
      creditSystemKey: 'guest_ledger_ar',
      amount: params.amount,
    });

    const updated = await this.recomputeAndSave(invoice.id);

    // Har bir qabul qilingan to'lovdan Guest CRM/Loyalty ballari hisoblanadi
    // (mehmonsiz hisob-faktura bo'lsa, LoyaltyService bu holatni o'zi jim o'tkazib yuboradi).
    await this.loyaltyService.awardPointsForPayment(
      tenantId,
      invoice.guestId,
      params.amount,
      invoice.id,
    );

    return updated;
  }

  // Bekor qilish faqat hali TO'LOV OLINMAGAN hisob-fakturalar uchun avtomatik
  // hisobot yozuvlarini teskari qiladi (Debitorlik/Daromad qatorlarini nolga
  // tushiradi). Agar hisob-fakturaga qisman to'lov qilingan bo'lsa (paidAmount > 0),
  // avtomatik teskari yozuv QILINMAYDI — bu holat qaytarish (refund) jarayonini
  // talab qiladi, bu hozircha alohida (keyingi bosqich) funksionallik. Buxgalter
  // bunday holatlarda qo'lda tuzatish yozuvi kiritishi kerak.
  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        "To'liq to'langan hisob-fakturani bekor qilib bo'lmaydi",
      );
    }
    // 🔴 2026-09-05 (audit): bu tekshiruv yo'q edi. Bekor qilingan
    // hisob-fakturada `paidAmount` hamon '0.00' bo'lgani uchun pastdagi
    // shart yana o'tar va UCHALA teskari provodka QAYTA yozilardi —
    // ya'ni ikki marta bosish daromad va debitorlikni manfiyga tushirardi.
    // Har bir yozuv o'zi balanslangani uchun `postJournalEntry` tekshiruvi
    // buni ushlamasdi va hech qanday signal bo'lmasdi.
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        'Hisob-faktura allaqachon bekor qilingan',
      );
    }

    if (Number(invoice.paidAmount) === 0) {
      const roomAmount = this.sumLines(invoice.lines, [
        InvoiceLineSource.ROOM_CHARGE,
        InvoiceLineSource.ADJUSTMENT,
      ]);
      const fbAmount = this.sumLines(invoice.lines, [
        InvoiceLineSource.POS_ORDER,
      ]);
      const otherAmount = this.sumLines(invoice.lines, [
        InvoiceLineSource.MANUAL,
      ]);
      // Jarima ALOHIDA: u `cancellation_fee_revenue` ni kreditlagan,
      // shuning uchun teskari yozuv ham aynan o'sha hisobga tushishi kerak.
      const feeAmount = this.sumLines(invoice.lines, [
        InvoiceLineSource.CANCELLATION_FEE,
      ]);

      // Teskari yozuv — asl provodkadagi debet/kredit hisoblari almashtirilgan
      // holda, xuddi shu (ishorali) miqdor bilan.
      await this.accountingService.postSimpleEntry({
        tenantId,
        propertyId,
        description: `Hisob-faktura bekor qilindi (xona daromadi) — ${invoice.id.slice(0, 8)}`,
        sourceModule: 'invoicing',
        sourceId: invoice.id,
        debitSystemKey: 'room_revenue',
        creditSystemKey: 'guest_ledger_ar',
        amount: roomAmount,
      });
      await this.accountingService.postSimpleEntry({
        tenantId,
        propertyId,
        description: `Hisob-faktura bekor qilindi (F&B daromadi) — ${invoice.id.slice(0, 8)}`,
        sourceModule: 'invoicing',
        sourceId: invoice.id,
        debitSystemKey: 'fb_revenue',
        creditSystemKey: 'guest_ledger_ar',
        amount: fbAmount,
      });
      await this.accountingService.postSimpleEntry({
        tenantId,
        propertyId,
        description: `Hisob-faktura bekor qilindi (boshqa daromad) — ${invoice.id.slice(0, 8)}`,
        sourceModule: 'invoicing',
        sourceId: invoice.id,
        debitSystemKey: 'other_operated_revenue',
        creditSystemKey: 'guest_ledger_ar',
        amount: otherAmount,
      });
      await this.accountingService.postSimpleEntry({
        tenantId,
        propertyId,
        description: `Hisob-faktura bekor qilindi (jarima) — ${invoice.id.slice(0, 8)}`,
        sourceModule: 'invoicing',
        sourceId: invoice.id,
        debitSystemKey: 'cancellation_fee_revenue',
        creditSystemKey: 'guest_ledger_ar',
        amount: feeAmount,
      });
    }

    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  private sumLines(lines: InvoiceLine[], sources: InvoiceLineSource[]): number {
    return lines
      .filter((l) => sources.includes(l.source))
      .reduce((sum, l) => sum + Number(l.amount), 0);
  }

  private assertChargeable(invoice: Invoice): void {
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new ConflictException(
        `Bu hisob-fakturaga endi xarajat qo'shib bo'lmaydi (joriy holat: ${invoice.status})`,
      );
    }
  }

  private isFullyPaid(invoice: Invoice): boolean {
    return (
      Number(invoice.paidAmount) >= Number(invoice.totalAmount) &&
      Number(invoice.totalAmount) > 0
    );
  }

  private async recomputeAndSave(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOneOrFail({
      where: { id: invoiceId },
    });
    const [lines, payments] = await Promise.all([
      this.lineRepo.find({ where: { invoiceId } }),
      this.paymentRepo.find({ where: { invoiceId } }),
    ]);

    invoice.totalAmount = lines
      .reduce((sum, l) => sum + Number(l.amount), 0)
      .toFixed(2);
    invoice.paidAmount = payments
      .reduce((sum, p) => sum + Number(p.amount), 0)
      .toFixed(2);

    if (invoice.status !== InvoiceStatus.CANCELLED) {
      if (this.isFullyPaid(invoice)) {
        invoice.status = InvoiceStatus.PAID;
      } else if (invoice.status === InvoiceStatus.PAID) {
        // to'lov keyinchalik bekor qilinishi mumkin emas hozircha, lekin xavfsizlik uchun:
        invoice.status = invoice.issuedAt
          ? InvoiceStatus.ISSUED
          : InvoiceStatus.OPEN;
      }
    }

    return this.invoiceRepo.save(invoice);
  }
}
