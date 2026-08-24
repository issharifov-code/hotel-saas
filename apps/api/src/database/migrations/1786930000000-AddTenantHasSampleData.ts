import { MigrationInterface, QueryRunner } from 'typeorm';

// Sample/demo ma'lumot generatsiyasi (2026-08-24): har bir yangi ro'yxatdan
// o'tgan tenant endi avtomatik ravishda namunaviy xonalar/mehmonlar/bronlar
// bilan to'ldiriladi (SampleDataService, AuthService.registerTenant orqali
// chaqiriladi). `has_sample_data` shu holatni kuzatadi — front-end shu bayroq
// true bo'lsa "Namunaviy ma'lumotlarni o'chirish" bannerini ko'rsatadi.
// `tenants` jadvali RLS ostida emas (platforma darajasidagi jadval), shuning
// uchun bu yerda RLS siyosati o'zgarmaydi.
export class AddTenantHasSampleData1786930000000 implements MigrationInterface {
  name = 'AddTenantHasSampleData1786930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "has_sample_data" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "has_sample_data"`);
  }
}
