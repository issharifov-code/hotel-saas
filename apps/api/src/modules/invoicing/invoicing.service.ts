import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLine, InvoiceLineSource } from './entities/invoice-line.entity';
import { InvoicePayment } from './entities/invoice-payment.entity';
import { AddInvoiceLineDto } from './dto/add-invoice-line.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class InvoicingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine) private readonly lineRepo: Repository<InvoiceLine>,
    @InjectRepository(InvoicePayment) private readonly paymentRepo: Repository<InvoicePayment>,
  ) {}

  // Check-in paytida BookingsService tomonidan chaqiriladi — folio ochiladi va
  // xona narxi birinchi qator sifatida qo'shiladi. Idempotent: agar booking uchun
  // hisob-faktura allaqachon mavjud bo'lsa, o'shani qaytaradi (qayta yaratmaydi).
  async openFolio(tenantId: string, propertyId: string, booking: Booking): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({ where: { tenantId, propertyId, bookingId: booking.id } });
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
    return this.invoiceRepo.save(invoice);
  }

  // Check-out paytida BookingsService tomonidan chaqiriladi — folio qat'iylashadi
  // ("issued"). To'lov holati tekshirilmaydi: check-out to'lovdan mustaqil
  // (biznes qoida — tasdiqlangan), to'lanmagan qoldiq keyin kuzatiladi.
  async issueFolio(tenantId: string, propertyId: string, bookingId: string): Promise<Invoice | null> {
    const invoice = await this.invoiceRepo.findOne({ where: { tenantId, propertyId, bookingId } });
    if (!invoice || invoice.status !== InvoiceStatus.OPEN) return invoice ?? null;

    invoice.status = this.isFullyPaid(invoice) ? InvoiceStatus.PAID : InvoiceStatus.ISSUED;
    invoice.issuedAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async listByProperty(tenantId: string, propertyId: string, status?: InvoiceStatus): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: status ? { tenantId, propertyId, status } : { tenantId, propertyId },
      relations: { booking: { room: true }, guest: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { booking: { room: true }, guest: true, lines: true, payments: true },
      order: { lines: { createdAt: 'ASC' }, payments: { createdAt: 'ASC' } },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    return invoice;
  }

  async findByBooking(tenantId: string, propertyId: string, bookingId: string): Promise<Invoice | null> {
    const invoice = await this.invoiceRepo.findOne({ where: { tenantId, propertyId, bookingId } });
    if (!invoice) return null;
    return this.findById(tenantId, propertyId, invoice.id);
  }

  async addLine(tenantId: string, propertyId: string, id: string, dto: AddInvoiceLineDto): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    this.assertChargeable(invoice);

    const amount = (dto.quantity * dto.unitPrice).toFixed(2);
    await this.lineRepo.save(
      this.lineRepo.create({
        invoiceId: invoice.id,
        description: dto.description,
        source: InvoiceLineSource.MANUAL,
        quantity: dto.quantity.toFixed(2),
        unitPrice: dto.unitPrice.toFixed(2),
        amount,
      }),
    );

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
    const invoice = await this.invoiceRepo.findOne({ where: { tenantId, propertyId, bookingId } });
    if (!invoice) {
      throw new ConflictException("Bu bron uchun ochiq hisob-faktura topilmadi (mehmon check-in qilinganmi?)");
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

    return this.recomputeAndSave(invoice.id);
  }

  async addPayment(tenantId: string, propertyId: string, id: string, dto: AddPaymentDto, userId: string): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException("Bekor qilingan hisob-fakturaga to'lov qo'shib bo'lmaydi");
    }

    await this.paymentRepo.save(
      this.paymentRepo.create({
        invoiceId: invoice.id,
        amount: dto.amount.toFixed(2),
        method: dto.method,
        receivedByUserId: userId,
        notes: dto.notes ?? null,
      }),
    );

    return this.recomputeAndSave(invoice.id);
  }

  async cancel(tenantId: string, propertyId: string, id: string): Promise<Invoice> {
    const invoice = await this.findById(tenantId, propertyId, id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException("To'liq to'langan hisob-fakturani bekor qilib bo'lmaydi");
    }
    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  private assertChargeable(invoice: Invoice): void {
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        `Bu hisob-fakturaga endi xarajat qo'shib bo'lmaydi (joriy holat: ${invoice.status})`,
      );
    }
  }

  private isFullyPaid(invoice: Invoice): boolean {
    return Number(invoice.paidAmount) >= Number(invoice.totalAmount) && Number(invoice.totalAmount) > 0;
  }

  private async recomputeAndSave(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOneOrFail({ where: { id: invoiceId } });
    const [lines, payments] = await Promise.all([
      this.lineRepo.find({ where: { invoiceId } }),
      this.paymentRepo.find({ where: { invoiceId } }),
    ]);

    invoice.totalAmount = lines.reduce((sum, l) => sum + Number(l.amount), 0).toFixed(2);
    invoice.paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2);

    if (invoice.status !== InvoiceStatus.CANCELLED) {
      if (this.isFullyPaid(invoice)) {
        invoice.status = InvoiceStatus.PAID;
      } else if (invoice.status === InvoiceStatus.PAID) {
        // to'lov keyinchalik bekor qilinishi mumkin emas hozircha, lekin xavfsizlik uchun:
        invoice.status = invoice.issuedAt ? InvoiceStatus.ISSUED : InvoiceStatus.OPEN;
      }
    }

    return this.invoiceRepo.save(invoice);
  }
}
