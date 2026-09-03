import { MigrationInterface, QueryRunner } from 'typeorm';

// Ro'yxatdan o'tish formasiga qo'shilgan ikkita ixtiyoriy maydonni saqlash
// uchun ustunlar (2026-09-03): mehmonxonaning taxminiy xonalar soni
// (bucket qiymat — "1–20" kabi, DemoRequest.note'dagi bir xil "Xonalar
// soni" naqshiga o'xshab, lekin bu yerda alohida ustun sifatida — chunki
// ro'yxatdan o'tish strukturaviy ma'lumot, keyinchalik segmentatsiya/
// filtrlash uchun so'rovga qulay bo'lishi kerak) va ro'yxatdan o'tuvchi
// egasining lavozimi (erkin matn).
export class AddTenantRoomsCountAndUserPosition1787700000000 implements MigrationInterface {
  name = 'AddTenantRoomsCountAndUserPosition1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "rooms_count_hint" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "position" character varying(150)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "position"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "rooms_count_hint"`,
    );
  }
}
