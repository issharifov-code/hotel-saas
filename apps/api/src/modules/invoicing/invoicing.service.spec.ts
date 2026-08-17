import { InvoicingService } from './invoicing.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { InvoicePaymentMethod } from './entities/invoice-payment.entity';

// recordGatewayPayment — Payments moduli (to'lov shlyuzi adapterlari)
// muvaffaqiyatli to'lovdan keyin chaqiradigan metod. Qo'lda kiritilgan
// addPayment'dan farqli o'laroq, method har doim ONLINE va
// provider/providerRef maydonlari to'ldiriladi ekanini sinaydi.
describe('InvoicingService.recordGatewayPayment', () => {
  function createService() {
    const invoice = {
      id: 'inv-1',
      guestId: 'guest-1',
      status: InvoiceStatus.OPEN,
      totalAmount: '1000.00',
      paidAmount: '0.00',
    };
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice),
      findOneOrFail: jest.fn().mockResolvedValue({ ...invoice }),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const paymentRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'pay-1', ...data }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    const lineRepo = { find: jest.fn().mockResolvedValue([]) };
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue(null),
    };
    const loyaltyService = {
      awardPointsForPayment: jest.fn().mockResolvedValue(undefined),
    };

    const service = new InvoicingService(
      invoiceRepo as never,
      lineRepo as never,
      paymentRepo as never,
      accountingService as never,
      loyaltyService as never,
    );
    return { service, paymentRepo, accountingService };
  }

  it("method=ONLINE va provider/providerRef maydonlari bilan to'lov yozadi", async () => {
    const { service, paymentRepo } = createService();

    await service.recordGatewayPayment(
      't1',
      'p1',
      'inv-1',
      { amount: '250.00', provider: 'mock', providerRef: 'MOCK-xyz' },
      'user-1',
    );

    const createdArg = paymentRepo.create.mock.calls[0][0];
    expect(createdArg.method).toBe(InvoicePaymentMethod.ONLINE);
    expect(createdArg.provider).toBe('mock');
    expect(createdArg.providerRef).toBe('MOCK-xyz');
    expect(createdArg.amount).toBe('250.00');
  });

  it('card_clearing hisobiga (ONLINE uchun) accounting yozuvi yaratadi', async () => {
    const { service, accountingService } = createService();

    await service.recordGatewayPayment(
      't1',
      'p1',
      'inv-1',
      { amount: '250.00', provider: 'mock', providerRef: 'MOCK-xyz' },
      'user-1',
    );

    expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        debitSystemKey: 'card_clearing',
        creditSystemKey: 'guest_ledger_ar',
      }),
    );
  });
});
