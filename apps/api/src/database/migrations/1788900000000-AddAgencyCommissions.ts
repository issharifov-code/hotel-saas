import { MigrationInterface, QueryRunner } from 'typeorm';

// Agentlik komissiyasi endi HISOBLANADIGAN emas, YOZILADIGAN bo'ldi
// (2026-09-04, foydalanuvchi qarori). Ilgari `AgenciesService.getSummary`
// har so'rovda `bookings.total_amount × agencies.commission_pct` ni qayta
// hisoblardi — bunda ikkita jiddiy kamchilik bor edi:
//
//   1. Komissiya foizini o'zgartirish BUTUN TARIXNI qayta yozardi. O'tgan
//      yilgi bronlar bo'yicha allaqachon to'langan komissiya bugungi foizga
//      ko'ra "boshqacha" ko'rinardi.
//   2. To'lovni qayd etadigan joy yo'q edi — "to'landimi yoki yo'qmi"
//      degan savolga tizim javob bera olmasdi.
//
// Shu sababdan `commission_pct` va `base_amount` provodka paytida SNAPSHOT
// qilinadi: qator yozilgandan keyin uning summasi hech qachon o'zgarmaydi.
//
// Ikkita jadval:
//   agency_commission_payments — agentlikka qilingan bitta to'lov
//   agency_commissions         — bitta bron uchun hisoblangan komissiya
//
// To'lov jadvali BIRINCHI yaratiladi, chunki komissiya unga havola qiladi.
export class AddAgencyCommissions1788900000000 implements MigrationInterface {
  name = 'AddAgencyCommissions1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agency_commission_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "agency_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'UZS',
        "method" character varying(20) NOT NULL,
        "paid_on" date NOT NULL,
        "reference" character varying(200),
        "notes" character varying(1000),
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agency_commission_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_acp_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_acp_property" FOREIGN KEY ("property_id")
          REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_acp_agency" FOREIGN KEY ("agency_id")
          REFERENCES "agencies"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_acp_agency" ON "agency_commission_payments"
        ("tenant_id", "property_id", "agency_id", "paid_on")
    `);

    await queryRunner.query(`
      CREATE TABLE "agency_commissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "agency_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "base_amount" numeric(12,2) NOT NULL,
        "commission_pct" numeric(5,2) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'UZS',
        "status" character varying(20) NOT NULL DEFAULT 'accrued',
        "accrued_on" date NOT NULL,
        "payment_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agency_commissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ac_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ac_property" FOREIGN KEY ("property_id")
          REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ac_agency" FOREIGN KEY ("agency_id")
          REFERENCES "agencies"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ac_booking" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ac_payment" FOREIGN KEY ("payment_id")
          REFERENCES "agency_commission_payments"("id") ON DELETE SET NULL
      )
    `);

    // 🔴 Idempotentlikning DB darajasidagi kafolati: bitta bron uchun ikkinchi
    // komissiya qatori yozilmaydi. Servisda ham tekshiruv bor, lekin ikkita
    // check-out so'rovi bir vaqtda kelsa faqat shu indeks to'sib qoladi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_agency_commissions_booking" ON "agency_commissions" ("booking_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ac_agency_status" ON "agency_commissions"
        ("tenant_id", "property_id", "agency_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ac_agency_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_agency_commissions_booking"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agency_commissions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_acp_agency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agency_commission_payments"`);
  }
}
