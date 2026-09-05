import { validate } from 'class-validator';
import { IsOptional } from 'class-validator';
import {
  IsMoneyString,
  IsPercentString,
  IsQuantityString,
  IsSignedQuantityString,
  IsUnitCostString,
} from './numeric-string.validator';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Ilgari pul maydonlari
// `@IsNumberString()` bilan tekshirilardi — u `-5000000` ni ham qabul
// qiladi. `AccountingService.postSimpleEntry` esa manfiy summada
// debet/kreditni almashtiradi, ya'ni oddiy xodim bosh kitobda teskari
// provodka yasab, mehmon folio balansini yoki payables'ni kamaytira
// olardi. Bu testlar aynan shu darvozani qo'riqlaydi.
class MoneyDto {
  @IsMoneyString('price')
  price: string;
}
class CostDto {
  @IsUnitCostString('unitCost')
  unitCost: string;
}
class QtyDto {
  @IsQuantityString('quantity')
  quantity: string;
}
class SignedQtyDto {
  @IsSignedQuantityString('quantity')
  quantity: string;
}
class PctDto {
  @IsOptional()
  @IsPercentString('commissionPct')
  commissionPct?: string;
}

async function fails(instance: object): Promise<boolean> {
  const errors = await validate(instance);
  return errors.length > 0;
}

describe('numeric-string validatorlari', () => {
  describe('IsMoneyString', () => {
    it.each(['0', '1', '350000', '350000.00', '350000.5', '9999999999.99'])(
      "to'g'ri summani qabul qiladi: %s",
      async (v) => {
        expect(await fails(Object.assign(new MoneyDto(), { price: v }))).toBe(
          false,
        );
      },
    );

    it.each([
      '-5000000', // 🔴 asosiy holat: teskari provodka
      '-0.01',
      '+999',
      '1e5',
      'Infinity',
      'NaN',
      '350000.123', // 2 dan ortiq kasr xona
      '12345678901', // 10 dan ortiq butun xona -> numeric to'lib ketishi
      '',
      ' 100',
    ])('rad etadi: %s', async (v) => {
      expect(await fails(Object.assign(new MoneyDto(), { price: v }))).toBe(
        true,
      );
    });
  });

  describe('IsUnitCostString', () => {
    it('4 kasr xonaga ruxsat beradi', async () => {
      expect(
        await fails(Object.assign(new CostDto(), { unitCost: '12345.6789' })),
      ).toBe(false);
    });
    it('manfiy tannarxni rad etadi', async () => {
      expect(
        await fails(Object.assign(new CostDto(), { unitCost: '-12345.6789' })),
      ).toBe(true);
    });
    it('5 kasr xonani rad etadi', async () => {
      expect(
        await fails(Object.assign(new CostDto(), { unitCost: '1.23456' })),
      ).toBe(true);
    });
  });

  describe('IsQuantityString', () => {
    it('3 kasr xonaga ruxsat beradi', async () => {
      expect(
        await fails(Object.assign(new QtyDto(), { quantity: '10.500' })),
      ).toBe(false);
    });
    it('manfiy miqdorni rad etadi', async () => {
      expect(await fails(Object.assign(new QtyDto(), { quantity: '-1' }))).toBe(
        true,
      );
    });
  });

  // Inventarizatsiya tuzatishi ataylab manfiy bo'lishi mumkin — bu
  // yagona joy, va u alohida dekorator bilan aniq belgilangan.
  describe('IsSignedQuantityString', () => {
    it('manfiy miqdorga ruxsat beradi', async () => {
      expect(
        await fails(Object.assign(new SignedQtyDto(), { quantity: '-7.250' })),
      ).toBe(false);
    });
    it('musbatga ham ruxsat beradi', async () => {
      expect(
        await fails(Object.assign(new SignedQtyDto(), { quantity: '7' })),
      ).toBe(false);
    });
    it("ikki marta minusni rad etadi", async () => {
      expect(
        await fails(Object.assign(new SignedQtyDto(), { quantity: '--7' })),
      ).toBe(true);
    });
  });

  describe('IsPercentString', () => {
    it.each(['0', '10', '10.00', '99.99', '100', '100.00'])(
      'qabul qiladi: %s',
      async (v) => {
        expect(
          await fails(Object.assign(new PctDto(), { commissionPct: v })),
        ).toBe(false);
      },
    );

    it.each([
      '10000', // 🔴 asosiy holat: bron qiymatidan 100 barobar komissiya
      '100.01',
      '101',
      '-10',
      '10.123',
    ])('rad etadi: %s', async (v) => {
      expect(
        await fails(Object.assign(new PctDto(), { commissionPct: v })),
      ).toBe(true);
    });

    it("ixtiyoriy maydon bo'sh bo'lsa o'tadi", async () => {
      expect(await fails(new PctDto())).toBe(false);
    });
  });
});
