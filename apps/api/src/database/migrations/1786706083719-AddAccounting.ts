import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccounting1786706083719 implements MigrationInterface {
    name = 'AddAccounting1786706083719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounts_type_enum" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_department_enum" AS ENUM('rooms', 'food_beverage', 'other_operated', 'miscellaneous_income', 'undistributed_expenses', 'fixed_charges')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_normal_balance_enum" AS ENUM('debit', 'credit')`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "code" character varying(20) NOT NULL, "name" character varying(200) NOT NULL, "type" "public"."accounts_type_enum" NOT NULL, "department" "public"."accounts_department_enum", "normal_balance" "public"."accounts_normal_balance_enum" NOT NULL, "system_key" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_676b27b97853130f8e6b410875b" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c1cce1e0d9cc2557038a7f639d" ON "accounts"  ("tenant_id") `);
        await queryRunner.query(`CREATE TABLE "journal_entry_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "debit" numeric(14,2) NOT NULL DEFAULT '0', "credit" numeric(14,2) NOT NULL DEFAULT '0', "description" character varying(255), CONSTRAINT "PK_b2f60e3664cd9803a829fb61aa4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "property_id" uuid NOT NULL, "entry_date" date NOT NULL, "description" character varying(255) NOT NULL, "source_module" character varying(20) NOT NULL, "source_id" uuid, "created_by_user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a70368e64230434457c8d007ab3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bdfde7db450aad783e5c258341" ON "journal_entries"  ("tenant_id", "property_id") `);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "FK_9a54f62140d93c608634baad589" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "FK_4a4fcd732e7b109880444ebc9c1" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "FK_4a4fcd732e7b109880444ebc9c1"`);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "FK_9a54f62140d93c608634baad589"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdfde7db450aad783e5c258341"`);
        await queryRunner.query(`DROP TABLE "journal_entries"`);
        await queryRunner.query(`DROP TABLE "journal_entry_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1cce1e0d9cc2557038a7f639d"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_normal_balance_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_department_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_type_enum"`);
    }

}
