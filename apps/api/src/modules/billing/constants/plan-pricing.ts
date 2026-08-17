import { TenantPlan } from '../../tenants/entities/tenant.entity';

export interface PlanPricing {
  plan: TenantPlan;
  label: string;
  monthlyPrice: number;
  currency: string;
  maxProperties: number;
  maxUsers: number;
}

// MUHIM: bu narxlar va limitlar HOZIRCHA O'RNIga QO'YILGAN (placeholder) —
// haqiqiy tarif rejasi narxlari va cheklovlari foydalanuvchi bilan hali
// kelishilmagan biznes qarori. To'lov shlyuzi ulanmagan bosqichda (hozirgi
// holat) bu qiymatlar faqat hisob-faktura summasini avtomatik hisoblash va
// tarif taqqoslash jadvalini ko'rsatish uchun ishlatiladi. O'zgartirish oson —
// faqat shu faylni tahrirlash kifoya (DB'ga bog'liq emas).
export const PLAN_PRICING: Record<TenantPlan, PlanPricing> = {
  [TenantPlan.START]: {
    plan: TenantPlan.START,
    label: 'Start',
    monthlyPrice: 490_000,
    currency: 'UZS',
    maxProperties: 1,
    maxUsers: 5,
  },
  [TenantPlan.PROFESSIONAL]: {
    plan: TenantPlan.PROFESSIONAL,
    label: 'Professional',
    monthlyPrice: 1_490_000,
    currency: 'UZS',
    maxProperties: 3,
    maxUsers: 20,
  },
  [TenantPlan.ENTERPRISE]: {
    plan: TenantPlan.ENTERPRISE,
    label: 'Enterprise',
    monthlyPrice: 3_990_000,
    currency: 'UZS',
    maxProperties: 999,
    maxUsers: 999,
  },
};

export function listPlanPricing(): PlanPricing[] {
  return Object.values(PLAN_PRICING);
}
