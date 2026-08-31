import { MigrationInterface, QueryRunner } from 'typeorm';

// Bron bekor qilingan/kelmagan (no-show) bo'lsa olingan jarima summasini
// saqlash uchun — nullable (jarima olinmagan yoki hali bekor qilinmagan bronlar
// uchun NULL).
export class AddCancellationFeeAmountToBookings1787400100000 implements MigrationInterface {
  name = 'AddCancellationFeeAmountToBookings1787400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "cancellation_fee_amount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "cancellation_fee_amount"`,
    );
  }
}
