import { MigrationInterface, QueryRunner } from 'typeorm';

const APP_ROLE = 'hotel_saas_app';

// 🔴 INTEGRATSION TESTDA TOPILGAN NUQSON (2026-09-05).
//
// MUAMMO. `permissions` — statik katalog: (modul, amal) juftliklari,
// ular enum'dan kelib chiqadi, tenantga bog'liq emas va RLS ostida
// emas. Uni HECH QANDAY migratsiya to'ldirmaydi — qatorlarni
// `PermissionsService.ensureAllPermissionsExist()` yozadi, ya'ni YANGI
// TENANT RO'YXATDAN O'TGANDA, ilova roli bilan.
//
// Shu bilan birga `EnableRowLevelSecurityBilling` (1789600000000)
// migratsiyasi eng kam huquq tamoyili bo'yicha ilova rolidan bu
// jadvalga yozishni ATAYLAB olib tashlagan:
//
//     REVOKE INSERT, UPDATE, DELETE ON "permissions" FROM "hotel_saas_app"
//
// Ikkalasi birga ZIDDIYAT. U bugungi production'da KO'RINMAYDI, chunki
// barcha 65 ta qator o'sha REVOKE'dan OLDIN yozilgan va endi hech narsa
// qo'shilmaydi. Lekin ikki holatda darhol yiqiladi:
//
//   1. `PermissionModule` yoki `PermissionAction` enum'iga YANGI qiymat
//      qo'shilsa — keyingi ro'yxatdan o'tish 500 qaytaradi
//      ("permission denied for table permissions"). Ya'ni mina
//      kelajakdagi eng oddiy o'zgarish ostida yotibdi.
//   2. Yangi muhit faqat migratsiyalardan qurilsa (sinov muhiti, CI,
//      falokatdan keyin bo'sh bazadan tiklash) — birinchi tenant
//      umuman ro'yxatdan o'ta olmaydi.
//
// 955 ta unit test buni ko'rmagan va KO'RA HAM OLMASDI: ularda
// repository mock, ya'ni GRANT'lar umuman ishtirok etmaydi. Nuqson
// integratsion testlarning BIRINCHI ishga tushishida topildi.
//
// NEGA KATALOGNI MIGRATSIYAGA KO'CHIRMADIK (birinchi urinish).
// Eng to'g'ri joy — katalogni migratsiya to'ldirishi va ilova roli
// faqat o'qishi. Lekin bu ishlamaydi: bo'sh bazada BARCHA migratsiyalar
// bitta tranzaksiyada bajariladi (TypeORM standarti `all`), va
// PostgreSQL o'sha tranzaksiyada `ALTER TYPE ... ADD VALUE` bilan
// qo'shilgan qiymatni ishlatishga ruxsat bermaydi:
//
//     ERROR: unsafe use of new value "payroll" of enum type
//     HINT:  New enum values must be committed before they can be used.
//
// Bu haqiqiy baza bilan tekshirildi; `DO $$ ... EXECUTE` orqali dinamik
// SQL ham ayni xatoni beradi. Ishlashi uchun butun deploy'ni
// `migrationsTransactionMode: 'each'` ga o'tkazish kerak bo'lardi —
// ya'ni migratsiya o'rtada yiqilsa baza YARIM holatda qolardi. Bitta
// katalog uchun butun deploy'ning "hammasi yoki hech narsa"
// kafolatidan voz kechish arzimaydi.
//
// YECHIM. Ilova roliga faqat `INSERT` qaytariladi. `UPDATE` va `DELETE`
// REVOKE holicha qoladi, ya'ni eng kam huquq tamoyili o'z kuchida:
// ilova katalogga yetishmayotgan qatorni QO'SHA oladi (uning yagona
// ehtiyoji), lekin mavjudini o'zgartira yoki o'chira OLMAYDI — ya'ni
// rollarga bog'langan ruxsatlarni buzib bo'lmaydi. Jadvalda (module,
// action) bo'yicha noyoblik cheklovi bor, demak takroriy qator ham
// paydo bo'lmaydi.
export class GrantPermissionCatalogueInsert1789900000000
  implements MigrationInterface
{
  name = 'GrantPermissionCatalogueInsert1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT INSERT ON "permissions" TO "${APP_ROLE}"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE INSERT ON "permissions" FROM "${APP_ROLE}"`,
    );
  }
}
