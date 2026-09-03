import { MigrationInterface, QueryRunner } from 'typeorm';

// Attendance/Leave moduli: `attendance_records` — bitta xodim uchun, bitta
// kunlik davomat yozuvi (property+xodim+sana bo'yicha UNIQUE), va
// `leave_requests` — ta'til/kasallik so'rovlari (PENDING -> APPROVED/REJECTED/
// CANCELLED holat mashinasi). Ikkalasi ham DIRECT_TABLE (o'z tenant_id ustuni
// bilan) — PayrollRun bilan bir xil naqsh. `attendance_records.hours_worked`
// PayrollService.createRun tomonidan HOURLY xodimlarning oylik soatini
// avtomatik taklif qilish uchun o'qiladi (user.entity.ts'da oldindan
// hujjatlashtirilgan bo'shliqni to'ldiradi).
export class AddAttendanceLeave1788000000000 implements MigrationInterface {
  name = 'AddAttendanceLeave1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "attendance_records_status_enum" AS ENUM ('present', 'absent', 'leave', 'holiday')`,
    );
    await queryRunner.query(
      `CREATE TYPE "leave_requests_leave_type_enum" AS ENUM ('vacation', 'sick', 'unpaid', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "leave_requests_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "date" date NOT NULL,
        "status" "attendance_records_status_enum" NOT NULL DEFAULT 'present',
        "hours_worked" numeric(5,2),
        "notes" character varying(500),
        "recorded_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_records_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attendance_records_tenant_property" ON "attendance_records" ("tenant_id", "property_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_attendance_records_property_user_date" ON "attendance_records" ("property_id", "user_id", "date")`,
    );

    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "leave_type" "leave_requests_leave_type_enum" NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "reason" character varying(500),
        "status" "leave_requests_status_enum" NOT NULL DEFAULT 'pending',
        "requested_by_user_id" uuid NOT NULL,
        "decided_by_user_id" uuid,
        "decided_at" TIMESTAMP,
        "decision_notes" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_tenant_property" ON "leave_requests" ("tenant_id", "property_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_leave_requests_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "leave_requests"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_attendance_records_property_user_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_attendance_records_tenant_property"`,
    );
    await queryRunner.query(`DROP TABLE "attendance_records"`);

    await queryRunner.query(`DROP TYPE "leave_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "leave_requests_leave_type_enum"`);
    await queryRunner.query(`DROP TYPE "attendance_records_status_enum"`);
  }
}
