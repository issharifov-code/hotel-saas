import { MigrationInterface, QueryRunner } from 'typeorm';

// SaaS Billing moduli: platforma <-> tenant obuna to'lovlarini kuzatish
// uchun `subscription_invoices` jadvali. ATAYLAB RLS YO'Q — `tenants`/`users`
// jadvallari bilan bir xil sabab (platforma darajasidagi jadval, tenant-scoped
// emas; batafsil izoh: SubscriptionInvoice entity fayli va
// EnableRowLevelSecurity migratsiyasidagi tegishli qism).
export class AddSubscriptionBilling1786800000000 implements MigrationInterface {
  name = 'AddSubscriptionBilling1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_invoices_plan_enum" AS ENUM('start', 'professional', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_invoices_status_enum" AS ENUM('pending', 'paid', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "subscription_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "plan" "public"."subscription_invoices_plan_enum" NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'UZS',
        "status" "public"."subscription_invoices_status_enum" NOT NULL DEFAULT 'pending',
        "due_date" date NOT NULL,
        "issued_at" TIMESTAMP NOT NULL,
        "paid_at" TIMESTAMP,
        "marked_paid_by_user_id" uuid,
        "notes" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_invoices" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscription_invoices_tenant_id" ON "subscription_invoices" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_invoices_tenant_id"`);
    await queryRunner.query(`DROP TABLE "subscription_invoices"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_invoices_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_invoices_plan_enum"`);
  }
}
