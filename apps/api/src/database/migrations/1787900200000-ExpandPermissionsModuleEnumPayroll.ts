import { MigrationInterface, QueryRunner } from 'typeorm';

// PermissionModule enum'iga yangi 'payroll' qiymati qo'shildi (permission.enum.ts),
// lekin Postgres'dagi "permissions_module_enum" turi buni avtomatik bilmaydi —
// TypeORM `synchronize: false` bilan ishlaydi, shuning uchun mavjud enum turini
// qo'lda kengaytirish kerak (xuddi shu andozadagi ExpandAccountDepartmentEnum
// migratsiyasiga o'xshab). Buni qilmasak, PermissionsService.ensureAllPermissionsExist
// 'payroll' qiymatini yozishga uringanda "invalid input value for enum" xatosi
// bilan yiqiladi — yangi tenant ro'yxatdan o'tkazishda yoki mavjud tenant uchun
// standart rollarni qayta seed qilishda.
export class ExpandPermissionsModuleEnumPayroll1787900200000 implements MigrationInterface {
  name = 'ExpandPermissionsModuleEnumPayroll1787900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."permissions_module_enum" ADD VALUE IF NOT EXISTS 'payroll'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum qiymatini olib tashlash uchun butun turni (va uni ishlatuvchi
    // ustunni/qatorlarni) qayta yaratish kerak bo'ladi — bu operatsion ma'lumotlarni
    // yo'qotish xavfini tug'diradi, shuning uchun bu migratsiya qaytarilmaydi
    // (down() ataylab bo'sh — ExpandAccountDepartmentEnum'dagi kabi amaliyot).
  }
}
