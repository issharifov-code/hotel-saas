import { InvoicingService } from './invoicing.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { InvoicePaymentMethod } from './entities/invoice-payment.entity';

// recordGatewayPayment — Payments moduli (to'lov shlyuzi adapterlari)
// muvaffaqiyatli to'lovdan keyin chaqiradigan metod. Qo'lda kiritilgan
// addPayment'dan farqli o'laroq, method har doim ONLINE va
// provider/providerRef maydonlari to'ldiriladi ekanini sinaydi.
describe('InvoicingService.recordGatewayPayment', () => {
  function createService(invoiceOverrides: Record<string, unknown> = {}) {
    const invoice = {
      id: 'inv-1',
      guestId: 'guest-1',
      status: InvoiceStatus.OPEN,
      totalAmount: '1000.00',
      paidAmount: '0.00',
      ...invoiceOverrides,
    };
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice),
      findOneOrFail: jest.fn().mockResolvedValue({ ...invoice }),
      // persistPayment endi to'lovni yozishdan oldin invoice qatorini
      // (pessimistic_write) bloklab, eng so'nggi holatni shundan o'qiydi —
      // shuning uchun mock query-builder zanjiri kerak.
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...invoice }),
      })),
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
    return { service, invoiceRepo, paymentRepo, accountingService };
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

// persistPayment (addPayment/recordGatewayPayment ikkalasi ham shu orqali o'tadi)
// endi to'lovni yozishdan oldin invoice qatorini bloklab, so'nggi qoldiqni qayta
// tekshiradi — bu avval umuman mavjud bo'lmagan himoya edi (qo'lda addPayment
// hech qanday yuqori chegarasiz to'lov yozib qo'yishga ruxsat berardi).
describe('InvoicingService — qoldiqdan oshiq to\'lovni rad etish', () => {
  function createService(invoiceOverrides: Record<string, unknown> = {}) {
    const invoice = {
      id: 'inv-1',
      guestId: 'guest-1',
      status: InvoiceStatus.OPEN,
      totalAmount: '100.00',
      paidAmount: '0.00',
      ...invoiceOverrides,
    };
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice),
      findOneOrFail: jest.fn().mockResolvedValue({ ...invoice }),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...invoice }),
      })),
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
    return { service, paymentRepo };
  }

  it("addPayment (qo'lda kiritish) qoldiqdan (100.00) katta summani rad etadi", async () => {
    const { service } = createService();

    await expect(
      service.addPayment(
        't1',
        'p1',
        'inv-1',
        { amount: 5000, method: InvoicePaymentMethod.CASH },
        'user-1',
      ),
    ).rejects.toThrow(/qoldiqdan/);
  });

  it('addPayment qoldiq ichidagi summani muvaffaqiyatli qabul qiladi', async () => {
    const { service, paymentRepo } = createService();

    await service.addPayment(
      't1',
      'p1',
      'inv-1',
      { amount: 60, method: InvoicePaymentMethod.CASH },
      'user-1',
    );

    expect(paymentRepo.save).toHaveBeenCalled();
  });

  it('recordGatewayPayment ham qoldiqdan katta summani rad etadi', async () => {
    const { service } = createService();

    await expect(
      service.recordGatewayPayment(
        't1',
        'p1',
        'inv-1',
        { amount: '150.00', provider: 'mock', providerRef: 'MOCK-1' },
        'user-1',
      ),
    ).rejects.toThrow(/qoldiqdan/);
  });

  it("qisman to'langan hisob-fakturada qolgan qoldiqdan oshiqni rad etadi", async () => {
    const { service } = createService({ paidAmount: '80.00' });

    // qoldiq endi 20.00, 25 so'ralsa rad etilishi kerak
    await expect(
      service.addPayment(
        't1',
        'p1',
        'inv-1',
        { amount: 25, method: InvoicePaymentMethod.CASH },
        'user-1',
      ),
    ).rejects.toThrow(/qoldiqdan/);
  });

  it('bekor qilingan hisob-fakturaga (bloklangan holatda) to\'lov qo\'shib bo\'lmaydi', async () => {
    const { service } = createService({ status: InvoiceStatus.CANCELLED });

    await expect(
      service.addPayment(
        't1',
        'p1',
        'inv-1',
        { amount: 10, method: InvoicePaymentMethod.CASH },
        'user-1',
      ),
    ).rejects.toThrow(/Bekor qilingan/);
  });
});
