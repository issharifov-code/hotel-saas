import { MigrationInterface, QueryRunner } from 'typeorm';

// Payroll moduli: har bir davr (oy) uchun bitta "ishga tushirish" yozuvi
// (`payroll_runs`, property+yil+oy bo'yicha UNIQUE — bitta oyni ikki marta
// yopib bo'lmaydi) va uning ichida har bir xodim uchun bitta payslip qatori
// (`payslip_entries`, ish haqi hisoblanishi paytidagi "suratga olingan"
// (snapshot) qiymatlar bilan — keyinchalik User.salaryAmount o'zgarsa ham,
// eski payroll yozuvlari o'zgarmay qoladi).
export class AddPayroll1787900000000 implements MigrationInterface {
  name = 'AddPayroll1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "payroll_runs_status_enum" AS ENUM ('draft', 'finalized', 'paid')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payslip_entries_salary_type_enum" AS ENUM ('monthly', 'hourly')`,
    );

    await queryRunner.query(`
      CREATE TABLE "payroll_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "period_year" integer NOT NULL,
        "period_month" integer NOT NULL,
        "status" "payroll_runs_status_enum" NOT NULL DEFAULT 'draft',
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "run_by_user_id" uuid NOT NULL,
        "finalized_by_user_id" uuid,
        "finalized_at" TIMESTAMP,
        "paid_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_runs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payroll_runs_tenant_property" ON "payroll_runs" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_payroll_runs_property_period" ON "payroll_runs" ("property_id", "period_year", "period_month")`,
    );

    await queryRunner.query(`
      CREATE TABLE "payslip_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payroll_run_id" uuid NOT NULL,
        "user_id" uuid,
        "employee_name_snapshot" character varying(200) NOT NULL,
        "salary_type" "payslip_entries_salary_type_enum" NOT NULL,
        "rate_snapshot" numeric(12,2) NOT NULL,
        "hours_worked" numeric(8,2),
        "gross_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "adjustment_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "adjustment_note" character varying(500),
        "net_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payslip_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payslip_entries_payroll_run_id" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payslip_entries_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payslip_entries_payroll_run_id" ON "payslip_entries" ("payroll_run_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payslip_entries_payroll_run_id"`,
    );
    await queryRunner.query(`DROP TABLE "payslip_entries"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_payroll_runs_property_period"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payroll_runs_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "payroll_runs"`);

    await queryRunner.query(`DROP TYPE "payslip_entries_salary_type_enum"`);
    await queryRunner.query(`DROP TYPE "payroll_runs_status_enum"`);
  }
}
