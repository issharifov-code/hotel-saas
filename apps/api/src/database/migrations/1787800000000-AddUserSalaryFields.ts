import { MigrationInterface, QueryRunner } from 'typeorm';

// Payroll moduli uchun poydevor (2026-09): xodimga maosh turi (oylik/soatlik)
// va tegishli stavka biriktirish. Ikkalasi ham ixtiyoriy/nullable — mavjud
// xodimlar uchun NULL bo'lib qoladi (maoshi hali belgilanmagan xodimlar
// PayrollService.createRun tomonidan avtomatik chetlab o'tiladi).
export class AddUserSalaryFields1787800000000 implements MigrationInterface {
  name = 'AddUserSalaryFields1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "users_salary_type_enum" AS ENUM ('monthly', 'hourly')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "salary_type" "users_salary_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "salary_amount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "salary_amount"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "salary_type"`);
    await queryRunner.query(`DROP TYPE "users_salary_type_enum"`);
  }
}
