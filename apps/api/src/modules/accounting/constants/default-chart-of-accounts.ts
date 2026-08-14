import { AccountDepartment, AccountType, NormalBalance } from '../entities/account.entity';

export interface DefaultAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  department: AccountDepartment | null;
  normalBalance: NormalBalance;
  systemKey: string | null;
}

// Soddalashtirilgan USALI (Uniform System of Accounts for the Lodging Industry,
// 12th edition) asosidagi standart hisoblar rejasi — har bir yangi tenant uchun
// ro'yxatdan o'tishda avtomatik yaratiladi (qarang: TenantsService).
//
// To'liq USALI yuzlab hisobni o'z ichiga oladi (har bir departament uchun batafsil
// ish haqi/mukofot/xarajat kichik hisoblari). Bu yerda MVP uchun eng ko'p
// ishlatiladigan asosiy hisoblar saqlangan — departamental tuzilma (Rooms, F&B,
// Other Operated, Undistributed Expenses, Fixed Charges) to'liq USALI'ga mos,
// shuning uchun keyinchalik yangi hisob qo'shish (masalan ish haqi kichik hisoblari)
// mavjud tuzilmani buzmasdan amalga oshiriladi.
//
// `systemKey` berilgan hisoblar AccountingService tomonidan avtomatik provodka
// (auto-posting) uchun ishlatiladi — bu qiymatlar KOD EMAS, shuning uchun tenant
// hisob nomini/kodini keyinchalik o'zgartirsa ham avtomatik provodka ishlashda davom etadi.
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountDefinition[] = [
  // ── AKTIVLAR ──────────────────────────────────────────────────────────
  { code: '1000', name: 'Kassa', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: 'cash' },
  { code: '1010', name: 'Bank hisobvarag\'i', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: 'bank_transfer' },
  { code: '1020', name: 'Karta to\'lovlari kliringi', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: 'card_clearing' },
  { code: '1100', name: 'Mehmonlar hisobvarag\'i (Guest Ledger)', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: 'guest_ledger_ar' },
  { code: '1110', name: 'Boshqa debitorlik qarzlar', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '1200', name: 'Ombor zaxiralari', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: 'inventory' },
  { code: '1300', name: 'Oldindan to\'langan xarajatlar', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '1500', name: 'Asosiy vositalar', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '1510', name: 'Asosiy vositalar amortizatsiyasi (to\'plangan)', type: AccountType.ASSET, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },

  // ── MAJBURIYATLAR ─────────────────────────────────────────────────────
  { code: '2000', name: 'Kreditorlik qarzlar (ta\'minotchilar)', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: 'accounts_payable' },
  { code: '2100', name: 'To\'lanishi kerak soliqlar', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },
  { code: '2110', name: 'QQS (VAT) majburiyati', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },
  { code: '2200', name: 'Mehmon depozitlari / oldindan to\'lovlar', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },
  { code: '2300', name: 'Xodimlarga to\'lanadigan ish haqi', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },
  { code: '2900', name: 'Uzoq muddatli qarzlar', type: AccountType.LIABILITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },

  // ── KAPITAL ───────────────────────────────────────────────────────────
  { code: '3000', name: 'Ustav kapitali', type: AccountType.EQUITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },
  { code: '3900', name: 'Taqsimlanmagan foyda', type: AccountType.EQUITY, department: null, normalBalance: NormalBalance.CREDIT, systemKey: null },

  // ── DAROMADLAR (departamental, USALI) ────────────────────────────────
  { code: '4100', name: 'Xona daromadi', type: AccountType.REVENUE, department: AccountDepartment.ROOMS, normalBalance: NormalBalance.CREDIT, systemKey: 'room_revenue' },
  { code: '4200', name: 'Oziq-ovqat va ichimlik daromadi', type: AccountType.REVENUE, department: AccountDepartment.FOOD_BEVERAGE, normalBalance: NormalBalance.CREDIT, systemKey: 'fb_revenue' },
  { code: '4300', name: 'Boshqa operatsion daromad', type: AccountType.REVENUE, department: AccountDepartment.OTHER_OPERATED, normalBalance: NormalBalance.CREDIT, systemKey: 'other_operated_revenue' },
  { code: '4900', name: 'Boshqa daromadlar', type: AccountType.REVENUE, department: AccountDepartment.MISCELLANEOUS_INCOME, normalBalance: NormalBalance.CREDIT, systemKey: 'misc_income' },

  // ── DEPARTAMENT XARAJATLARI (Cost of Sales) ─────────────────────────
  { code: '5100', name: 'Xonalar bo\'limi xarajatlari', type: AccountType.EXPENSE, department: AccountDepartment.ROOMS, normalBalance: NormalBalance.DEBIT, systemKey: 'rooms_department_expense' },
  { code: '5200', name: 'Oziq-ovqat va ichimlik tannarxi', type: AccountType.EXPENSE, department: AccountDepartment.FOOD_BEVERAGE, normalBalance: NormalBalance.DEBIT, systemKey: 'cogs_fb' },
  { code: '5210', name: 'Ombor tanqisligi/ortig\'i (tuzatish)', type: AccountType.EXPENSE, department: AccountDepartment.FOOD_BEVERAGE, normalBalance: NormalBalance.DEBIT, systemKey: 'inventory_variance' },
  { code: '5300', name: 'Boshqa operatsion bo\'lim xarajatlari', type: AccountType.EXPENSE, department: AccountDepartment.OTHER_OPERATED, normalBalance: NormalBalance.DEBIT, systemKey: 'general_supplies_expense' },

  // ── TAQSIMLANMAGAN OPERATSION XARAJATLAR (Undistributed) ────────────
  { code: '6000', name: 'Ma\'muriy va umumiy xarajatlar', type: AccountType.EXPENSE, department: AccountDepartment.UNDISTRIBUTED_EXPENSES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '6100', name: 'Sotuv va marketing', type: AccountType.EXPENSE, department: AccountDepartment.UNDISTRIBUTED_EXPENSES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '6200', name: 'Mulkni saqlash va ta\'mirlash', type: AccountType.EXPENSE, department: AccountDepartment.UNDISTRIBUTED_EXPENSES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '6300', name: 'Kommunal xizmatlar', type: AccountType.EXPENSE, department: AccountDepartment.UNDISTRIBUTED_EXPENSES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '6400', name: 'Axborot va telekommunikatsiya tizimlari', type: AccountType.EXPENSE, department: AccountDepartment.UNDISTRIBUTED_EXPENSES, normalBalance: NormalBalance.DEBIT, systemKey: null },

  // ── QAT'IY XARAJATLAR (Fixed Charges) ────────────────────────────────
  { code: '7000', name: 'Ijara', type: AccountType.EXPENSE, department: AccountDepartment.FIXED_CHARGES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '7100', name: 'Mulk solig\'i va sug\'urta', type: AccountType.EXPENSE, department: AccountDepartment.FIXED_CHARGES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '7200', name: 'Foizlar xarajati', type: AccountType.EXPENSE, department: AccountDepartment.FIXED_CHARGES, normalBalance: NormalBalance.DEBIT, systemKey: null },
  { code: '7300', name: 'Amortizatsiya xarajati', type: AccountType.EXPENSE, department: AccountDepartment.FIXED_CHARGES, normalBalance: NormalBalance.DEBIT, systemKey: null },
];
