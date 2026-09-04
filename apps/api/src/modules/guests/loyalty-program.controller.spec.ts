import { LoyaltyProgramController } from './loyalty-program.controller';
import {
  POINTS_PER_CURRENCY_UNIT,
  TIER_THRESHOLDS,
  calculateLoyaltyTier,
} from './loyalty-formula.util';

// Sodiqlik dasturi qoidalari endpoint'i (2026-09-04).
//
// Maqsad — frontend ko'rsatadigan qoidalar HAQIQATAN ballarni hisoblaydigan
// formulalar bilan bir xil bo'lishi. Agar kimdir bo'sag'ani faqat bitta
// joyda o'zgartirsa, shu testlar buni ushlaydi.
describe('LoyaltyProgramController', () => {
  const controller = new LoyaltyProgramController();

  it('bo\'sag\'alar pastdan yuqoriga saralangan holda qaytadi', () => {
    const { tiers } = controller.program();
    expect(tiers.map((t) => t.tier)).toEqual([
      'bronze',
      'silver',
      'gold',
      'platinum',
    ]);
    const thresholds = tiers.map((t) => t.threshold);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });

  it('qaytarilgan bo\'sag\'alar haqiqiy formula bilan MOS keladi', () => {
    // Har bir bo'sag'ada aynan o'sha daraja boshlanishi kerak — ya'ni
    // ko'rsatilayotgan jadval yolg'on gapirmasin.
    for (const { tier, threshold } of controller.program().tiers) {
      expect(calculateLoyaltyTier(threshold)).toBe(tier);
      if (threshold > 0) {
        expect(calculateLoyaltyTier(threshold - 1)).not.toBe(tier);
      }
    }
  });

  it('ball formulasi ham shu manbadan olinadi', () => {
    expect(controller.program().pointsPerCurrencyUnit).toBe(
      POINTS_PER_CURRENCY_UNIT,
    );
    expect(controller.program().tiers).toHaveLength(TIER_THRESHOLDS.length);
  });
});
