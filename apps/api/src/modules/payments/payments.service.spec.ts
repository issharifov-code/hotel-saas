import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InvoiceStatus } from '../invoicing/entities/invoice.entity';

// PaymentsService — to'lov shlyuzi adapter orkestratsiyasini sinaydi:
// muvaffaqiyatli mock to'lov InvoicingService'ga to'g'ri yoziladi, noma'lum
// provayder va qoldiqdan oshiq summa rad etiladi, muvaffaqiyatsiz shlyuz
// javobi hisob-fakturaga hech narsa yozmaydi.
describe('PaymentsService', () => {
  function createService(overrides?: { chargeResult?: unknown }) {
    const invoice = {
      id: 'inv-1',
      status: InvoiceStatus.OPEN,
      totalAmount: '1000.00',
      paidAmount: '400.00',
      currency: 'UZS',
    };
    // 🔴 2026-09-05 auditi (Medium): shlyuzga murojaatdan OLDIN
    // hisob-faktura qatori qulflanadi va tekshiruvlar o'sha qulf ostida
    // bajariladi. Mock shu shartnomani takrorlaydi.
    const invoicingService = {
      findById: jest.fn().mockResolvedValue(invoice),
      lockInvoiceForPayment: jest
        .fn()
        .mockImplementation((_t: string, _p: string, _id: string, amount: string) => {
          if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new ConflictException(
              "Bekor qilingan hisob-fakturaga to'lov qo'shib bo'lmaydi",
            );
          }
          const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
          if (Number(amount) > balance + 0.005) {
            throw new ConflictException(
              `To'lov summasi qoldiqdan (${balance.toFixed(2)}) oshib ketmasligi kerak`,
            );
          }
          return Promise.resolve(invoice);
        }),
      recordGatewayPayment: jest
        .fn()
        .mockResolvedValue({ ...invoice, paidAmount: '500.00' }),
    };
    const mockAdapter = {
      provider: 'mock',
      charge: jest.fn().mockResolvedValue(
        overrides?.chargeResult ?? {
          success: true,
          providerRef: 'MOCK-abc-123',
        },
      ),
    };
    const service = new PaymentsService(
      [mockAdapter],
      invoicingService as never,
    );
    return { service, invoicingService, mockAdapter, invoice };
  }

  it("mock adapter muvaffaqiyatli bo'lsa, InvoicingService.recordGatewayPayment'ga to'g'ri parametrlar bilan yozadi", async () => {
    const { service, invoicingService } = createService();

    const result = await service.chargeInvoice(
      't1',
      'p1',
      'inv-1',
      { amount: 100 },
      'user-1',
    );

    expect(invoicingService.recordGatewayPayment).toHaveBeenCalledWith(
      't1',
      'p1',
      'inv-1',
      { amount: '100.00', provider: 'mock', providerRef: 'MOCK-abc-123' },
      'user-1',
    );
    expect(result.paidAmount).toBe('500.00');
  });

  it("noma'lum provider so'ralsa BadRequestException tashlaydi", async () => {
    const { service } = createService();
    await expect(
      service.chargeInvoice(
        't1',
        'p1',
        'inv-1',
        { amount: 100, provider: 'payme' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("to'lov summasi qoldiqdan oshsa ConflictException tashlaydi", async () => {
    // qoldiq = 1000 - 400 = 600, so'ralgan summa 700 — oshib ketadi
    const { service } = createService();
    await expect(
      service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 700 }, 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  it("bekor qilingan hisob-fakturaga to'lov urinishi ConflictException tashlaydi", async () => {
    const { service, invoice } = createService();
    // Bekor qilinganlik endi QULF OSTIDA tekshiriladi, ya'ni
    // `lockInvoiceForPayment` ichida — shuning uchun holatni obyektning
    // o'zida o'zgartiramiz.
    invoice.status = InvoiceStatus.CANCELLED;
    await expect(
      service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 100 }, 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Ilgari shlyuz QULFDAN
  // OLDIN chaqirilardi: ikkita bir vaqtdagi so'rov mehmon kartasidan
  // ikki marta pul yechib, bittasini yozib qo'ymasdi. Tartib endi
  // teskari — bu test aynan shu tartibni qo'riqlaydi.
  it("shlyuzga murojaatdan OLDIN hisob-faktura qulflanadi", async () => {
    const { service, invoicingService, mockAdapter } = createService();
    const order: string[] = [];
    invoicingService.lockInvoiceForPayment.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve({
        id: 'inv-1',
        status: InvoiceStatus.OPEN,
        totalAmount: '1000.00',
        paidAmount: '400.00',
        currency: 'UZS',
      });
    });
    mockAdapter.charge.mockImplementation(() => {
      order.push('charge');
      return Promise.resolve({ success: true, providerRef: 'MOCK-1' });
    });

    await service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 100 }, 'user-1');

    expect(order).toEqual(['lock', 'charge']);
  });

  it('shlyuz muvaffaqiyatsiz javob qaytarsa UnprocessableEntityException tashlaydi va hech narsa yozilmaydi', async () => {
    const { service, invoicingService } = createService({
      chargeResult: {
        success: false,
        providerRef: '',
        failureReason: 'karta rad etildi',
      },
    });

    await expect(
      service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 100 }, 'user-1'),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(invoicingService.recordGatewayPayment).not.toHaveBeenCalled();
  });
});
