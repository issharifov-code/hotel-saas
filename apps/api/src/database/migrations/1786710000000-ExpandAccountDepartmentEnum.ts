import { MigrationInterface, QueryRunner } from 'typeorm';

// USALI 12th Edition'ning rasmiy Schedule tuzilmasiga to'liq mos kelish uchun
// `accounts_department_enum`ga yangi qiymatlar qo'shiladi (qarang:
// AccountDepartment enum, account.entity.ts). Eski qiymatlar (undistributed_expenses,
// fixed_charges) PostgreSQL enum turidan xavfsiz o'chirib bo'lmagani (butun turni
// qayta yaratishni talab qiladi) va eski seed qilingan ma'lumotlar bilan orqaga
// moslikni saqlash uchun o'chirilmaydi — shunchaki endi ishlatilmaydi.
export class ExpandAccountDepartmentEnum1786710000000 implements MigrationInterface {
  name = 'ExpandAccountDepartmentEnum1786710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const newValues = [
      'admin_general',
      'info_telecom',
      'sales_marketing',
      'property_maintenance',
      'energy_water_waste',
      'payroll_related',
      'management_fees',
      'nonoperating',
    ];
    for (const value of newValues) {
      await queryRunner.query(`ALTER TYPE "public"."accounts_department_enum" ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL enum qiymatini olib tashlash uchun butun turni (va uni ishlatuvchi
    // ustunni) qayta yaratish kerak bo'ladi — bu operatsion jadval ma'lumotlarini
    // yo'qotish xavfini tug'diradi, shuning uchun bu migratsiya qaytarilmaydi
    // (down() ataylab bo'sh qoldirilgan, xuddi shu andozadagi boshqa loyihalarda
    // ham keng tarqalgan amaliyot).
  }
}
