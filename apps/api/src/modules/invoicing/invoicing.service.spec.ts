import { ConflictException } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLineSource } from './entities/invoice-line.entity';
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
describe("InvoicingService — qoldiqdan oshiq to'lovni rad etish", () => {
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

  it("bekor qilingan hisob-fakturaga (bloklangan holatda) to'lov qo'shib bo'lmaydi", async () => {
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

// createFeeInvoice — bekor qilish/no-show jarimasi uchun MUSTAQIL (standalone)
// hisob-faktura yaratadi (check-in'ga bog'liq emas, chunki bu bronlar hech
// qachon check-in qilinmagan — openFolio umuman chaqirilmagan bo'ladi).
describe('InvoicingService.createFeeInvoice', () => {
  function createService() {
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'inv-fee-1', ...data }),
      ),
    };
    const lineRepo = { create: jest.fn((data: unknown) => data) };
    const paymentRepo = {};
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue(null),
    };
    const loyaltyService = {};

    const service = new InvoicingService(
      invoiceRepo as never,
      lineRepo as never,
      paymentRepo as never,
      accountingService as never,
      loyaltyService as never,
    );
    return { service, invoiceRepo, accountingService };
  }

  const booking = {
    id: 'b1',
    guestId: 'guest-1',
    currency: 'UZS',
  };

  it('ISSUED holatida, guest_ledger_ar debet / berilgan creditSystemKey kredit bilan hisob-faktura yaratadi', async () => {
    const { service, invoiceRepo, accountingService } = createService();

    const result = await service.createFeeInvoice(
      't1',
      'p1',
      booking as never,
      'Bekor qilish jarimasi',
      '150.00',
      'cancellation_fee_revenue',
    );

    expect(result).toMatchObject({
      status: InvoiceStatus.ISSUED,
      totalAmount: '150.00',
      bookingId: 'b1',
      guestId: 'guest-1',
    });
    expect(invoiceRepo.save).toHaveBeenCalled();
    expect(accountingService.postSimpleEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        debitSystemKey: 'guest_ledger_ar',
        creditSystemKey: 'cancellation_fee_revenue',
        amount: '150.00',
      }),
    );
  });

  it("shu booking uchun hisob-faktura allaqachon mavjud bo'lsa, qayta yaratmasdan o'shani qaytaradi (idempotent)", async () => {
    const { service, invoiceRepo, accountingService } = createService();
    const existing = { id: 'inv-existing', bookingId: 'b1' };
    invoiceRepo.findOne.mockResolvedValue(existing);

    const result = await service.createFeeInvoice(
      't1',
      'p1',
      booking as never,
      'Bekor qilish jarimasi',
      '150.00',
      'cancellation_fee_revenue',
    );

    expect(result).toBe(existing);
    expect(invoiceRepo.save).not.toHaveBeenCalled();
    expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
  });
});


// 🔴 2026-09-05 (kod auditi) — ikkita topilma shu yerda mustahkamlanadi:
//  1. Bekor qilingan hisob-fakturani QAYTA bekor qilish teskari provodkani
//     takrorlardi (yagona tekshiruv `PAID` edi, `CANCELLED` esa emas).
//  2. Jarima qatori `adjustment` turida yozilgani uchun teskari yozuv
//     `room_revenue` ga tushardi, aslida `cancellation_fee_revenue` bo'lishi
//     kerak edi — Rooms daromadi kamayib, Miscellaneous Income oshib qolardi.
describe('InvoicingService.cancel — teskari provodka', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const invoice = {
      id: 'inv-11111111',
      guestId: 'guest-1',
      status: InvoiceStatus.ISSUED,
      totalAmount: '1000.00',
      paidAmount: '0.00',
      lines: [],
      ...overrides,
    };
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const accountingService = {
      postSimpleEntry: jest.fn().mockResolvedValue(null),
    };
    const service = new InvoicingService(
      invoiceRepo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      accountingService as never,
      { awardPointsForPayment: jest.fn() } as never,
    );
    return { service, invoiceRepo, accountingService };
  }

  const line = (source: InvoiceLineSource, amount: string) => ({
    source,
    amount,
  });

  it('allaqachon bekor qilingan hisob-fakturani qayta bekor qilib bo\'lmaydi', async () => {
    const { service, accountingService } = createService({
      status: InvoiceStatus.CANCELLED,
      lines: [line(InvoiceLineSource.ROOM_CHARGE, '1000.00')],
    });

    await expect(service.cancel('t1', 'p1', 'inv-11111111')).rejects.toThrow(
      ConflictException,
    );
    // Eng muhimi: ikkinchi provodka YOZILMAYDI.
    expect(accountingService.postSimpleEntry).not.toHaveBeenCalled();
  });

  it('jarima qatori cancellation_fee_revenue ga qaytariladi, room_revenue ga emas', async () => {
    const { service, accountingService } = createService({
      lines: [line(InvoiceLineSource.CANCELLATION_FEE, '800.00')],
    });

    await service.cancel('t1', 'p1', 'inv-11111111');

    const chaqiriqlar = accountingService.postSimpleEntry.mock.calls.map(
      (c: [Record<string, unknown>]) => c[0],
    );
    const jarima = chaqiriqlar.find(
      (c) => c.debitSystemKey === 'cancellation_fee_revenue',
    );
    expect(jarima).toMatchObject({
      debitSystemKey: 'cancellation_fee_revenue',
      creditSystemKey: 'guest_ledger_ar',
      // `sumLines` son qaytaradi — `postSimpleEntry` uni o'zi yaxlitlaydi.
      amount: 800,
    });
    // Xona daromadi bu holatda umuman tegilmaydi (0 yuboriladi -> yozuv yo'q).
    const xona = chaqiriqlar.find((c) => c.debitSystemKey === 'room_revenue');
    expect(xona).toMatchObject({ amount: 0 });
  });

  it("xona narxi va narx tuzatishi baribir room_revenue ga qaytariladi", async () => {
    const { service, accountingService } = createService({
      lines: [
        line(InvoiceLineSource.ROOM_CHARGE, '1000.00'),
        line(InvoiceLineSource.ADJUSTMENT, '250.00'),
      ],
    });

    await service.cancel('t1', 'p1', 'inv-11111111');

    const xona = accountingService.postSimpleEntry.mock.calls
      .map((c: [Record<string, unknown>]) => c[0])
      .find((c) => c.debitSystemKey === 'room_revenue');
    expect(xona).toMatchObject({ amount: 1250 });
  });
});

// 🔴 2026-09-05 (kod auditi): foliodagi qo'lda qo'shilgan qatorda
// bosilgan `quantity × unitPrice` saqlangan `amount` bilan mos kelmasdi.
describe('InvoicingService.addLine — qator ichki mosligi', () => {
  it("saqlangan miqdor va narx ko'paytmasi aynan saqlangan summaga teng", async () => {
    const invoice = {
      id: 'inv-1',
      status: InvoiceStatus.OPEN,
      totalAmount: '0.00',
      paidAmount: '0.00',
      lines: [],
    };
    const lineRepo = {
      create: (d: Record<string, unknown>) => d,
      save: jest.fn((d: Record<string, unknown>) =>
        Promise.resolve({ id: 'l1', ...d }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    const invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice),
      findOneOrFail: jest.fn().mockResolvedValue({ ...invoice }),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new InvoicingService(
      invoiceRepo as never,
      lineRepo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { postSimpleEntry: jest.fn().mockResolvedValue(null) } as never,
      { awardPointsForPayment: jest.fn() } as never,
    );

    // 3 × 1333.333 — xom ko'paytma 3999.999 -> 4000.00, saqlangan narx esa
    // 1333.33 bo'lardi (3 × 1333.33 = 3999.99).
    await service.addLine('t1', 'p1', 'inv-1', {
      description: 'Minibar',
      quantity: 3,
      unitPrice: 1333.333,
    } as never);

    const saved = lineRepo.save.mock.calls[0][0] as Record<string, string>;
    expect(
      (Number(saved.quantity) * Number(saved.unitPrice)).toFixed(2),
    ).toBe(saved.amount);
  });
});
