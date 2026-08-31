import { MigrationInterface, QueryRunner } from 'typeorm';

// City Ledger / Korporativ hisoblar (Corporate Accounts) — kompaniyalar
// bilan "kredit"da ishlash (mehmon o'rniga kompaniya to'laydi). Har bir shu
// hisob orqali kelgan bron (bookings.corporate_account_id) shu yerga
// bog'lanadi. Hech qanday avtomatik accounting provodkasi qilinmaydi —
// CityLedgerService.getStatement mavjud Invoice/InvoicePayment
// yozuvlaridan real vaqtda hisob-varaq hisoblab beradi.
export class AddCorporateAccounts1787100000000 implements MigrationInterface {
  name = 'AddCorporateAccounts1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "corporate_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "tax_id" character varying(50),
        "contact_name" character varying(200),
        "contact_phone" character varying(50),
        "contact_email" character varying(200),
        "billing_address" character varying(1000),
        "credit_limit" numeric(12,2),
        "payment_terms_days" integer NOT NULL DEFAULT 30,
        "notes" character varying(1000),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_corporate_accounts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_corporate_accounts_tenant_property" ON "corporate_accounts" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "corporate_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_corporate_account_id" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_corporate_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "corporate_account_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_corporate_accounts_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "corporate_accounts"`);
  }
}
