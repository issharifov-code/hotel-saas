import { MigrationInterface, QueryRunner } from 'typeorm';

// `users` — RLS qo'llanmagan YAGONA tenant jadvali edi (2026-09-05, kod
// auditi). Boshlang'ich `EnableRowLevelSecurity` migratsiyasi uni
// "keyingi bosqichda, bootstrap-bypass dizayni bilan" deb qoldirgan;
// `roles`/`user_roles` keyinchalik yopilgan, `users` esa unutilgan.
//
// Nima uchun bu jadval alohida yondashuvni talab qiladi:
//
//   `AuthService.login` foydalanuvchini TENANT KONTEKSTI O'RNATILISHIDAN
//   OLDIN va TENANTLAR BO'YLAB qidiradi (`findAllByEmail`) — email bir
//   tenant ichida unique, lekin turli tenantlarda takrorlanishi mumkin.
//   Oddiy `tenant_id = current_setting('app.tenant_id')` siyosati bu
//   so'rovni butunlay to'sib qo'yardi, ya'ni TIZIMGA KIRISH ISHLAMAY
//   QOLARDI.
//
// Shuning uchun siyosatga ANIQ, nomlangan chetlab o'tish qo'shiladi:
// `app.users_bypass`. Uni FAQAT `UsersService.withBypass()` yoqadi va
// darhol o'chiradi (o'sha metodning izohiga qarang) — ya'ni chetlab
// o'tish kod ichida ko'rinadigan, sanab bo'ladigan to'rtta joyda.
//
// Loyihaning "aniq tenant yo'q bo'lsa hech narsa ko'rinmasin" tamoyili
// shu bilan saqlanadi: kontekstsiz so'rov o'z-o'zidan cheklovsiz
// BO'LMAYDI, faqat aniq yoqilgan bayroq bilan.
//
// Nimadan himoya qiladi: `listByTenant`, `resetPassword`, `updateStatus`,
// `setSalary`, `getSalary`, `listActiveWithSalary` — bularning birortasida
// kelajakda `tenantId` filtri unutilsa, endi baza to'sib qoladi. Aynan shu
// jadvalda bcrypt hash, `salary_amount` va `is_platform_admin` turadi.
const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurityUsers1789300000000
  implements MigrationInterface
{
  name = 'EnableRowLevelSecurityUsers1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "users" TO "${APP_ROLE}"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY`);
    // 🔴 `NULLIF(..., '')` SHART. `set_config(..., true)` tranzaksiyaga
    // xos, va tranzaksiya tugagach PostgreSQL GUC'ni OLDINGI qiymatiga
    // qaytaradi — hech qachon global o'rnatilmagan maxsus GUC uchun bu
    // NULL emas, BO'SH SATR. Ya'ni bir marta tenant konteksti bilan
    // ishlatilgan pool ulanishida keyingi safar `current_setting` `''`
    // qaytaradi va `''::uuid` XATO tashlaydi (0 qator emas, 500).
    //
    // Buni shu migratsiyani mahalliy bazada sinash paytida aniqladik:
    // `register-tenant` oqimi aynan shu sababdan yiqildi. Mavjud boshqa
    // siyosatlarda ham xuddi shu ifoda ishlatilgan (ular bugun bu holatga
    // tushmaydi, chunki har doim tenant konteksti bilan chaqiriladi) —
    // qarang: kod auditi hujjatidagi eslatma.
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "users"
      USING (
        current_setting('app.users_bypass', true) = 'on'
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.users_bypass', true) = 'on'
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "users"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DISABLE ROW LEVEL SECURITY`);
    // GRANT qaytarilmaydi: u RLS'dan oldin ham bor edi (boshqa
    // migratsiyalar bilan berilgan), olib tashlansa ilova ishlamay qoladi.
  }
}
