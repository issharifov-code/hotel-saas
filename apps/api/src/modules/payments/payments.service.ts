import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InvoicingService } from '../invoicing/invoicing.service';
import { Invoice, InvoiceStatus } from '../invoicing/entities/invoice.entity';
import { ChargeInvoiceDto } from './dto/charge-invoice.dto';
import {
  PAYMENT_ADAPTERS,
  PaymentGatewayAdapter,
} from './interfaces/payment-gateway.interface';

const DEFAULT_PROVIDER = 'mock';

// Payments moduli — InvoicingService'ning "to'lov qabul qilindi" yozuvidan
// mustaqil qatlam: bu servis to'lov shlyuziga (hozircha faqat mock) murojaat
// qiladi, natija muvaffaqiyatli bo'lsagina InvoicingService'ga yozdiradi.
// Kelajakda Payme/Click adapteri qo'shilganda, faqat shu modul ichida
// o'zgarish kifoya — InvoicingService/Booking/Front-Desk kodiga tegilmaydi.
@Injectable()
export class PaymentsService {
  private readonly adaptersByProvider: Map<string, PaymentGatewayAdapter>;

  constructor(
    @Inject(PAYMENT_ADAPTERS) adapters: PaymentGatewayAdapter[],
    private readonly invoicingService: InvoicingService,
  ) {
    this.adaptersByProvider = new Map(adapters.map((a) => [a.provider, a]));
  }

  listProviders(): { provider: string }[] {
    return [...this.adaptersByProvider.keys()].map((provider) => ({
      provider,
    }));
  }

  async chargeInvoice(
    tenantId: string,
    propertyId: string,
    invoiceId: string,
    dto: ChargeInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.invoicingService.findById(
      tenantId,
      propertyId,
      invoiceId,
    );

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        "Bekor qilingan hisob-fakturaga to'lov qo'shib bo'lmaydi",
      );
    }
    const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > balance + 0.005) {
      throw new BadRequestException(
        `To'lov summasi qoldiqdan (${balance.toFixed(2)}) oshib ketmasligi kerak`,
      );
    }

    const provider = dto.provider ?? DEFAULT_PROVIDER;
    const adapter = this.adaptersByProvider.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Noma'lum to'lov provayderi: ${provider}`);
    }

    const amount = dto.amount.toFixed(2);
    const result = await adapter.charge({
      amount,
      currency: invoice.currency,
      invoiceId: invoice.id,
      description: `Hisob-faktura ${invoice.id.slice(0, 8)} to'lovi`,
    });

    if (!result.success) {
      throw new UnprocessableEntityException(
        `To'lov amalga oshmadi (${provider})${
          result.failureReason ? `: ${result.failureReason}` : ''
        }`,
      );
    }

    return this.invoicingService.recordGatewayPayment(
      tenantId,
      propertyId,
      invoiceId,
      { amount, provider, providerRef: result.providerRef },
      userId,
    );
  }
}
