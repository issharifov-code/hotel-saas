import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InvoicingService } from '../invoicing/invoicing.service';
import { Invoice } from '../invoicing/entities/invoice.entity';
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
    const provider = dto.provider ?? DEFAULT_PROVIDER;
    const adapter = this.adaptersByProvider.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Noma'lum to'lov provayderi: ${provider}`);
    }

    const amount = dto.amount.toFixed(2);

    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Ilgari bu yerda qoldiq
    // QULFLANMAGAN qatordan o'qilib tekshirilar, keyin shlyuz chaqirilar,
    // va faqat undan keyin `persistPayment` qatorni qulflardi. Natijada
    // ikkita bir vaqtdagi so'rov (masalan tugmani ikki marta bosish)
    // mehmon kartasidan IKKI MARTA pul yechib, bittasini yozib
    // qo'ymasdi — olingan pulning izi qolmasdi.
    //
    // Endi qulf shlyuzga murojaatdan OLDIN olinadi va so'rov
    // tranzaksiyasi tugagunicha ushlanadi: ikkinchi so'rov kutadi va
    // yangilangan qoldiqni ko'radi. Tekshiruvlar (bekor qilinganmi,
    // qoldiqdan oshmaydimi) o'sha qulf ostida bajariladi.
    const invoice = await this.invoicingService.lockInvoiceForPayment(
      tenantId,
      propertyId,
      invoiceId,
      amount,
    );

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
