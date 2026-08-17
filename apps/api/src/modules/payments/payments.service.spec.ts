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
    const invoicingService = {
      findById: jest.fn().mockResolvedValue(invoice),
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

  it("to'lov summasi qoldiqdan oshsa BadRequestException tashlaydi", async () => {
    // qoldiq = 1000 - 400 = 600, so'ralgan summa 700 — oshib ketadi
    const { service } = createService();
    await expect(
      service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 700 }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("bekor qilingan hisob-fakturaga to'lov urinishi ConflictException tashlaydi", async () => {
    const { service, invoicingService, invoice } = createService();
    invoicingService.findById.mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.CANCELLED,
    });
    await expect(
      service.chargeInvoice('t1', 'p1', 'inv-1', { amount: 100 }, 'user-1'),
    ).rejects.toThrow(ConflictException);
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
