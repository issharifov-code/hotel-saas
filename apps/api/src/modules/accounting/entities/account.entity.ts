import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

// USALI (Uniform System of Accounts for the Lodging Industry, 12th Revised Edition)
// rasmiy Schedule tuzilmasi bo'yicha departamental guruhlash — daromad/xarajat
// hisoblari uchun. Balans hisoblari (aktiv/passiv/kapital) uchun null (departamentga
// tegishli emas). Har biri rasmiy nashrdagi bitta Schedule'ga mos keladi:
// Schedule 1 (Rooms), 2 (Food and Beverage), 3 (Other Operated — soddalashtirilgan),
// 4 (Miscellaneous Income), 5 (Administrative and General), 6 (Information and
// Telecommunications Systems), 7 (Sales and Marketing), 8 (Property Operation and
// Maintenance), 9 (Energy, Water and Waste), 10 (Management Fees), 11 (Nonoperating
// Income and Expenses), 14 (Payroll-Related Expenses — property darajasida umumiy).
//
// ESKI qiymatlar (UNDISTRIBUTED_EXPENSES, FIXED_CHARGES) endi DEFAULT_CHART_OF_ACCOUNTS
// tomonidan ishlatilmaydi (o'rniga yuqoridagi aniqroq Schedule-asosli qiymatlar
// qo'llaniladi), lekin enum'dan olib tashlanmagan — PostgreSQL enum turidan qiymat
// o'chirish murakkab operatsiya (butun turni qayta yaratishni talab qiladi) va eski
// (allaqachon seed qilingan) tenant ma'lumotlari bilan orqaga moslikni buzmaslik uchun.
export enum AccountDepartment {
  ROOMS = 'rooms',
  FOOD_BEVERAGE = 'food_beverage',
  OTHER_OPERATED = 'other_operated',
  MISCELLANEOUS_INCOME = 'miscellaneous_income',
  ADMIN_GENERAL = 'admin_general',
  INFO_TELECOM = 'info_telecom',
  SALES_MARKETING = 'sales_marketing',
  PROPERTY_MAINTENANCE = 'property_maintenance',
  ENERGY_WATER_WASTE = 'energy_water_waste',
  PAYROLL_RELATED = 'payroll_related',
  MANAGEMENT_FEES = 'management_fees',
  NONOPERATING = 'nonoperating',
  /** @deprecated DEFAULT_CHART_OF_ACCOUNTS tomonidan endi ishlatilmaydi — orqaga moslik uchun saqlangan */
  UNDISTRIBUTED_EXPENSES = 'undistributed_expenses',
  /** @deprecated DEFAULT_CHART_OF_ACCOUNTS tomonidan endi ishlatilmaydi — orqaga moslik uchun saqlangan */
  FIXED_CHARGES = 'fixed_charges',
}

export enum NormalBalance {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

// Har bir tenant ro'yxatdan o'tganda standart (soddalashtirilgan USALI 12th edition
// asosidagi) hisoblar rejasi avtomatik yaratiladi (qarang: DEFAULT_CHART_OF_ACCOUNTS).
// `systemKey` — avtomatik provodka (auto-posting) mantig'i uchun "ma'lum" hisoblarni
// (Kassa, Mehmonlar hisobvarag'i, Xona daromadi va h.k.) ishonchli topish uchun ishlatiladi
// — shu bilan tenant hisob kodini/nomini o'zgartirsa ham avtomatik provodka buzilmaydi.
@Entity('accounts')
@Index(['tenantId'])
@Unique(['tenantId', 'code'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ type: 'enum', enum: AccountDepartment, nullable: true })
  department: AccountDepartment | null;

  @Column({ name: 'normal_balance', type: 'enum', enum: NormalBalance })
  normalBalance: NormalBalance;

  // Avtomatik provodka uchun barqaror kalit (masalan 'cash', 'room_revenue').
  // Tizim tomonidan yaratilgan hisoblarda to'ldirilgan, tenant qo'shgan qo'shimcha
  // hisoblarda null bo'ladi.
  @Column({ name: 'system_key', type: 'varchar', length: 50, nullable: true })
  systemKey: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
