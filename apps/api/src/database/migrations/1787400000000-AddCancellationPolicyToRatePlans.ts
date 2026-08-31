import { MigrationInterface, QueryRunner } from 'typeorm';

// Bekor qilish siyosati (Cancellation Policy) va kelmaslik (no-show) jarimasi —
// narx rejasiga (rate_plans) qo'shimcha, IXTIYORIY ustunlar. Hammasi nullable:
// mavjud rejalar uchun bu ustunlar NULL bo'lib qoladi, ya'ni avvalgi xulq-atvor
// (bekor qilish/no-show jarimasiz) o'zgarishsiz saqlanadi (backward compatible).
export class AddCancellationPolicyToRatePlans1787400000000 implements MigrationInterface {
  name = 'AddCancellationPolicyToRatePlans1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rate_plans_cancellation_fee_type_enum" AS ENUM('flat', 'percent_of_total', 'first_night')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rate_plans_no_show_fee_type_enum" AS ENUM('flat', 'percent_of_total', 'first_night')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD "cancellation_deadline_days" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD "cancellation_fee_type" "public"."rate_plans_cancellation_fee_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD "cancellation_fee_value" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD "no_show_fee_type" "public"."rate_plans_no_show_fee_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD "no_show_fee_value" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rate_plans" DROP COLUMN "no_show_fee_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" DROP COLUMN "no_show_fee_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" DROP COLUMN "cancellation_fee_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" DROP COLUMN "cancellation_fee_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" DROP COLUMN "cancellation_deadline_days"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."rate_plans_no_show_fee_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."rate_plans_cancellation_fee_type_enum"`,
    );
  }
}
