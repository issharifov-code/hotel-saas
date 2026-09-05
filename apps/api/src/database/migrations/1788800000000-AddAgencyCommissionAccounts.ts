import { MigrationInterface, QueryRunner } from 'typeorm';

// Turagent komissiyasini bosh kitobga yozish uchun ikkita "tizim hisobi"
// (systemKey) kerak — `AccountingService.postSimpleEntry` hisoblarni aynan
// shu barqaror kalitlar orqali topadi:
//
//   agency_commission_expense  → 5142 "Commissions" (xarajat, Rooms)
//   agency_commission_payable  → 2010 (yangi passiv hisob)
//
// 5142 allaqachon DEFAULT_CHART_OF_ACCOUNTS'da bor edi, lekin systemKey'siz —
// ya'ni avtomatik provodka uni topa olmasdi. 2010 esa umuman yo'q edi:
// mavjud 2000 "Kreditorlik qarzlar" ATAYLAB ishlatilmadi, chunki u
// ta'minotchilar qarzi va agentliklar qarzi u bilan aralashib ketsa,
// "agentliklarga qancha qarzdormiz" degan savolga javob berib bo'lmasdi.
//
// 🔴 Eng muhim jihat: `seedDefaultChartOfAccounts` FAQAT yangi tenant
// ro'yxatdan o'tganda ishlaydi. MAVJUD tenantlarga hisoblar shu migratsiya
// orqali qo'shilmasa, birinchi check-out'da `getAccountBySystemKey` 500
// xato tashlaydi va mehmonni chiqarib bo'lmay qoladi.
export class AddAgencyCommissionAccounts1788800000000
  implements MigrationInterface
{
  name = 'AddAgencyCommissionAccounts1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Mavjud 5142 "Commissions" hisobiga tizim kalitini beramiz.
    //    `system_key IS NULL` sharti — tenant uni allaqachon boshqa maqsadda
    //    band qilgan bo'lsa (qo'lda tahrirlash), ustidan yozmaymiz.
    await queryRunner.query(`
      UPDATE "accounts"
      SET "system_key" = 'agency_commission_expense'
      WHERE "code" = '5142' AND "system_key" IS NULL
    `);

    // 2) 🔴 Xuddi shu narsa 2010 uchun ham. Bu qadam avval yo'q edi va
    //    migratsiyani ortga qaytarib qayta yugurtirganda topildi: `down()`
    //    provodkasi bor hisobning system_key'ini NULL qiladi (hisobning
    //    o'zini o'chirmaydi), keyingi `up()` esa "2010 allaqachon bor" deb
    //    o'tkazib yuborardi — natijada kalit qaytmasdi va birinchi
    //    check-out'da 500 xato chiqardi.
    await queryRunner.query(`
      UPDATE "accounts"
      SET "system_key" = 'agency_commission_payable'
      WHERE "code" = '2010' AND "system_key" IS NULL
    `);

    // 3) Yetishmayotgan tenantlarda 5142 umuman bo'lmasligi mumkin (COA
    //    kengaytirilishidan oldin ro'yxatdan o'tgan tenantlar) — ularga
    //    hisobning o'zini yaratamiz.
    await queryRunner.query(`
      INSERT INTO "accounts"
        ("tenant_id", "code", "name", "type", "department", "normal_balance", "system_key", "is_active")
      SELECT DISTINCT t."id", '5142', 'Agentlik komissiyasi (xarajat)',
             'expense'::"public"."accounts_type_enum",
             'rooms'::"public"."accounts_department_enum",
             'debit'::"public"."accounts_normal_balance_enum",
             'agency_commission_expense', true
      FROM "tenants" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "accounts" a
        WHERE a."tenant_id" = t."id"
          AND (a."code" = '5142' OR a."system_key" = 'agency_commission_expense')
      )
    `);

    // 4) Agentliklarga to'lanadigan komissiya — yangi passiv hisob.
    await queryRunner.query(`
      INSERT INTO "accounts"
        ("tenant_id", "code", "name", "type", "department", "normal_balance", "system_key", "is_active")
      SELECT DISTINCT t."id", '2010', 'Agentliklarga to''lanadigan komissiya',
             'liability'::"public"."accounts_type_enum",
             -- Balans hisobi — departamentga tegishli emas. Oddiy NULL
             -- yetarli emas: PostgreSQL uni text deb qabul qiladi va
             -- enum ustuniga tushmaydi (migratsiya sinovida topilgan).
             NULL::"public"."accounts_department_enum",
             'credit'::"public"."accounts_normal_balance_enum",
             'agency_commission_payable', true
      FROM "tenants" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "accounts" a
        WHERE a."tenant_id" = t."id"
          AND (a."code" = '2010' OR a."system_key" = 'agency_commission_payable')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hisobda provodka bo'lsa o'chirmaymiz (jurnal qatorlari RESTRICT bilan
    // bog'langan va, muhimrog'i, buxgalteriya yozuvi yo'qolmasligi kerak) —
    // faqat hech qachon ishlatilmagan hisoblar olib tashlanadi, qolganlaridan
    // esa system_key yechiladi, ya'ni avtomatik provodka o'chadi, tarix qoladi.
    await queryRunner.query(`
      DELETE FROM "accounts" a
      WHERE a."system_key" IN ('agency_commission_payable', 'agency_commission_expense')
        AND NOT EXISTS (
          SELECT 1 FROM "journal_entry_lines" l WHERE l."account_id" = a."id"
        )
    `);
    await queryRunner.query(`
      UPDATE "accounts" SET "system_key" = NULL
      WHERE "system_key" IN ('agency_commission_payable', 'agency_commission_expense')
    `);
  }
}
