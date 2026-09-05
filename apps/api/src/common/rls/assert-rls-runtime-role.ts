import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low — L5). Butun tenant izolyatsiyasi
// bitta konfiguratsiya qiymatiga tayanadi: ilova baza jadvallarining
// EGASI BO'LMAGAN rol (`hotel_saas_app`) bilan ulanishi kerak. PostgreSQL
// jadval egasiga RLS'ni QO'LLAMAYDI (`FORCE ROW LEVEL SECURITY` yo'q
// bo'lsa), ya'ni `DB_APP_USERNAME` bir kun egaga yo'naltirilsa — masalan
// yangi muhitda "app roli yo'q ekan" deb tuzatilsa — barcha siyosatlar
// JIMGINA kuchsizlanadi. Xato ham, log ham, yiqilgan test ham bo'lmaydi:
// so'rovlar oddiygina barcha tenantlarning ma'lumotini qaytara boshlaydi.
//
// NIMA UCHUN `FORCE ROW LEVEL SECURITY` EMAS. U eganing o'ziga ham RLS
// qo'llagan bo'lardi va muammoni butunlay yopardi. Lekin migratsiyalar va
// `seed.ts` aynan ega roli bilan ishlaydi va tenant konteksti O'RNATMAYDI
// — ular FORCE bilan jimgina 0 qatorga ta'sir qiladigan bo'lib qolardi
// (masalan seed platforma adminini yarata olmasdi). To'g'ri yechim egaga
// `BYPASSRLS` berish bo'lardi, lekin buning uchun superuser kerak —
// Render'ning boshqariladigan Postgres'ida bu rol superuser emas
// (tekshirilgan: `rolsuper=false`).
//
// Shuning uchun jimgina buzilishni SHOVQINLI ishga tushmaslikka
// aylantiramiz: ilova ko'tarilishida ulanish rolini tekshiramiz.
const logger = new Logger('RlsRuntimeRole');

export interface RlsRuntimeRoleCheck {
  currentUser: string;
  bypassRls: boolean;
  ownedTables: number;
}

export async function inspectRlsRuntimeRole(
  dataSource: DataSource,
): Promise<RlsRuntimeRoleCheck> {
  const rows = await dataSource.query<
    { current_user: string; bypass_rls: boolean; owned_tables: string }[]
  >(`
    SELECT
      current_user,
      (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls,
      (SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND pg_get_userbyid(c.relowner) = current_user) AS owned_tables
  `);
  const row = rows[0];
  return {
    currentUser: row.current_user,
    bypassRls: Boolean(row.bypass_rls),
    ownedTables: Number(row.owned_tables),
  };
}

/**
 * Ulanish roli RLS ostida ekanini tasdiqlaydi. Ikkala holat ham
 * izolyatsiyani BUTUNLAY o'chiradi, shuning uchun ikkalasi ham ishga
 * tushishni to'xtatadi:
 *   * rol `BYPASSRLS` ga ega;
 *   * rol `public` sxemasidagi jadvallarning egasi.
 */
export function assertRlsRuntimeRole(check: RlsRuntimeRoleCheck): void {
  if (check.bypassRls) {
    throw new Error(
      `Baza roli "${check.currentUser}" BYPASSRLS huquqiga ega — bu barcha tenant izolyatsiya siyosatlarini o'chiradi. ` +
        'Ilova RLS ostidagi alohida rol bilan ulanishi kerak (DB_APP_USERNAME).',
    );
  }
  if (check.ownedTables > 0) {
    throw new Error(
      `Baza roli "${check.currentUser}" public sxemasidagi ${check.ownedTables} ta jadvalning egasi — ` +
        "PostgreSQL jadval egasiga RLS qo'llamaydi, ya'ni tenant izolyatsiyasi ishlamaydi. " +
        'DB_APP_USERNAME jadval egasi BO\'LMAGAN rolga yo\'naltirilishi kerak.',
    );
  }
  logger.log(
    `RLS ulanish roli tasdiqlandi: "${check.currentUser}" (ega emas, BYPASSRLS yo'q)`,
  );
}
