import { MigrationInterface, QueryRunner } from 'typeorm';

// Payments moduli (mock+adapter arxitekturasi — kelajakda Payme/Click uchun
// tayyor): `invoice_payments.method` enum'iga 'online' qiymati qo'shiladi
// (to'lov shlyuzi orqali qabul qilingan to'lovlarni belgilash uchun), va
// qaysi provayder ishlatilgani (`provider`) hamda tashqi tranzaksiya
// identifikatori (`provider_ref`) uchun ikkita yangi ustun qo'shiladi.
// RLS'ga tegishli o'zgarish yo'q — `invoice_payments` allaqachon RLS ostida.
export class AddPaymentGatewayFields1786910000000 implements MigrationInterface {
  name = 'AddPaymentGatewayFields1786910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."invoice_payments_method_enum" ADD VALUE IF NOT EXISTS 'online'`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" ADD "provider" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" ADD "provider_ref" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" DROP COLUMN "provider_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" DROP COLUMN "provider"`,
    );
    // PostgreSQL ENUM'dan qiymatni olib tashlab bo'lmaydi (DROP VALUE yo'q) —
    // 'online' qiymati enum turida qoladi, lekin ishlatilmaydi. Bu standart,
    // xavfsiz muqobil yechim (boshqa loyihalarda ham keng qo'llaniladi).
  }
}
