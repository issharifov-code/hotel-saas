import { MigrationInterface, QueryRunner } from 'typeorm';

// Guest CRM/Loyalty moduli: `guests` jadvaliga daraja/ball/izoh/tug'ilgan sana
// ustunlari qo'shiladi, va har bir ball o'zgarishini audit qiladigan yangi
// `loyalty_transactions` jadvali yaratiladi (RLS keyingi migratsiyada —
// `EnableRowLevelSecurityLoyalty1786790100000`).
export class AddGuestLoyalty1786790000000 implements MigrationInterface {
  name = 'AddGuestLoyalty1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."guests_loyalty_tier_enum" AS ENUM('bronze', 'silver', 'gold', 'platinum')`,
    );
    await queryRunner.query(`ALTER TABLE "guests" ADD "date_of_birth" date`);
    await queryRunner.query(`ALTER TABLE "guests" ADD "notes" text`);
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "loyalty_tier" "public"."guests_loyalty_tier_enum" NOT NULL DEFAULT 'bronze'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "loyalty_points" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD "lifetime_points" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."loyalty_transactions_type_enum" AS ENUM('earn', 'redeem', 'adjust')`,
    );
    await queryRunner.query(`
      CREATE TABLE "loyalty_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guest_id" uuid NOT NULL,
        "type" "public"."loyalty_transactions_type_enum" NOT NULL,
        "points" integer NOT NULL,
        "reason" character varying(255) NOT NULL,
        "related_invoice_id" uuid,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loyalty_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loyalty_transactions_guest_id" ON "loyalty_transactions" ("guest_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "FK_loyalty_transactions_guest_id" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "FK_loyalty_transactions_guest_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loyalty_transactions_guest_id"`,
    );
    await queryRunner.query(`DROP TABLE "loyalty_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."loyalty_transactions_type_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "lifetime_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "loyalty_points"`,
    );
    await queryRunner.query(`ALTER TABLE "guests" DROP COLUMN "loyalty_tier"`);
    await queryRunner.query(`ALTER TABLE "guests" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "guests" DROP COLUMN "date_of_birth"`);
    await queryRunner.query(`DROP TYPE "public"."guests_loyalty_tier_enum"`);
  }
}
