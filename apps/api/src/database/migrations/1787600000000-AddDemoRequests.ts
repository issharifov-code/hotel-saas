import { MigrationInterface, QueryRunner } from 'typeorm';

// Login sahifasidagi "Demo so'rash" formasidan kelgan murojaatlarni saqlash
// uchun `demo_requests` jadvali. ATAYLAB RLS YO'Q — `tenants`/`users`/
// `subscription_invoices` jadvallari bilan bir xil sabab (platforma
// darajasidagi jadval, tenant-scoped emas — murojaat qiluvchi hali hech
// qanday tenant'ga ega bo'lmasligi ham mumkin; batafsil izoh:
// EnableRowLevelSecurity migratsiyasidagi tegishli qism).
export class AddDemoRequests1787600000000 implements MigrationInterface {
  name = 'AddDemoRequests1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "demo_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying(200) NOT NULL,
        "phone" character varying(50) NOT NULL,
        "email" character varying(255),
        "note" character varying(1000),
        "contacted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_demo_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_demo_requests_created_at" ON "demo_requests" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_demo_requests_created_at"`);
    await queryRunner.query(`DROP TABLE "demo_requests"`);
  }
}
