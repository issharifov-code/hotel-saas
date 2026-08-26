import { MigrationInterface, QueryRunner } from 'typeorm';

// Turizm agentliklari / korporativ hamkorlar (Travel Agents / Corporate
// Accounts) — mehmonxonaga muntazam mehmon yo'naltiradigan tashqi
// tashkilotlar. Har bir shu agentlik orqali kelgan bron (bookings.agency_id)
// shu yerga bog'lanadi. Komissiya moliyaviy provodka sifatida YOZILMAYDI —
// faqat hisobot uchun (AgenciesService.getSummary, real vaqtda hisoblanadi).
export class AddAgencies1786970000000 implements MigrationInterface {
  name = 'AddAgencies1786970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "contact_name" character varying(200),
        "contact_phone" character varying(50),
        "contact_email" character varying(200),
        "commission_pct" numeric(5,2) NOT NULL DEFAULT 10,
        "notes" character varying(1000),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agencies" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agencies_tenant_property" ON "agencies" ("tenant_id", "property_id")`,
    );

    await queryRunner.query(`ALTER TABLE "bookings" ADD "agency_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_agency_id" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_agency_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "agency_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agencies_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "agencies"`);
  }
}
