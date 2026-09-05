import { MigrationInterface, QueryRunner } from 'typeorm';

// Barcha RLS siyosatlarida `current_setting(...)::uuid` -> `NULLIF(...)::uuid`
// (2026-09-05, `users` uchun RLS qo'shish paytida aniqlangan).
//
// MUAMMO. `set_config('app.tenant_id', ..., true)` tranzaksiyaga xos, va
// tranzaksiya tugagach PostgreSQL GUC'ni OLDINGI qiymatiga qaytaradi. Hech
// qachon global o'rnatilmagan maxsus GUC uchun bu qiymat **NULL emas, BO'SH
// SATR**. Ya'ni bir marta tenant konteksti bilan ishlatilgan pool ulanishi
// keyingi safar kontekstsiz ishlatilsa:
//
//   current_setting('app.tenant_id', true)  ->  ''
//   ''::uuid                                ->  ERROR
//
// Natijada siyosat "0 qator" o'rniga XATO qaytaradi — foydalanuvchi 500
// oladi. Mahalliy bazada tasdiqlangan:
//
//   BEGIN; set_config('app.tenant_id', '<uuid>', true); SELECT ... ; COMMIT;
//   BEGIN; SELECT count(*) FROM bookings; -- ERROR: invalid input syntax
//
// QACHON UCHRAYDI. Kontekst o'rnatilmagan har qanday so'rov:
//   * platforma admini (tenantId NULL) tenant jadvaliga tegsa;
//   * autentifikatsiyadan oldingi oqim RLS jadvalini o'qisa;
//   * kelajakda `applyTenantContext` chaqirilmay qolgan yo'l qo'shilsa.
// Bugungi kodda bu yo'llar kam, shuning uchun xato hali chiqmagan — lekin
// bu "ishlamaydi" degani emas, "hali tegib ketmagan" degani.
//
// `NULLIF(..., '')` bilan bo'sh satr NULL'ga aylanadi, `tenant_id = NULL`
// esa hech qachon rost bo'lmaydi — ya'ni siyosat aynan mo'ljallanganidek
// "hech narsa ko'rinmasin" holatiga tushadi.
//
// `users` bundan mustasno: u allaqachon NULLIF bilan yozilgan va o'zining
// `app.users_bypass` shartiga ega (migratsiya 1789300000000).

// O'z `tenant_id` ustuni bor jadvallar.
const DIRECT_TABLES = [
  'accounts', 'agencies', 'agency_commission_payments', 'agency_commissions',
  'attendance_records', 'booking_groups', 'bookings', 'budgets', 'channels',
  'corporate_accounts', 'function_space_bookings', 'function_spaces', 'guests',
  'housekeeping_tasks', 'insight_dismissals', 'invoices', 'journal_entries',
  'leave_requests', 'maintenance_tickets', 'menu_items', 'message_logs',
  'message_templates', 'night_audit_runs', 'payroll_runs', 'pos_orders',
  'pos_outlets', 'properties', 'purchase_orders', 'rate_plans', 'roles',
  'room_types', 'rooms', 'stock_items', 'stock_lots', 'stock_transactions',
  'suppliers', 'user_roles', 'warehouses',
];

// O'z `tenant_id`si yo'q — ota jadval orqali himoyalanadi.
// [jadval, ota jadval, ota'ga havola qiluvchi ustun]
const CHILD_TABLES: [string, string, string][] = [
  ['channel_room_type_mappings', 'channels', 'channel_id'],
  ['channel_sync_logs', 'channels', 'channel_id'],
  ['invoice_lines', 'invoices', 'invoice_id'],
  ['invoice_payments', 'invoices', 'invoice_id'],
  ['journal_entry_lines', 'journal_entries', 'journal_entry_id'],
  ['loyalty_transactions', 'guests', 'guest_id'],
  ['payslip_entries', 'payroll_runs', 'payroll_run_id'],
  ['pos_order_items', 'pos_orders', 'order_id'],
  ['purchase_order_items', 'purchase_orders', 'purchase_order_id'],
  ['rate_plan_restrictions', 'rate_plans', 'rate_plan_id'],
  ['role_permissions', 'roles', 'role_id'],
];

const SAFE = `NULLIF(current_setting('app.tenant_id', true), '')::uuid`;
const OLD = `current_setting('app.tenant_id', true)::uuid`;

function directPolicy(table: string, expr: string): string {
  return `
    CREATE POLICY "tenant_isolation" ON "${table}"
    USING (tenant_id = ${expr})
    WITH CHECK (tenant_id = ${expr})
  `;
}

function childPolicy(
  table: string,
  parent: string,
  fk: string,
  expr: string,
): string {
  const cond = `
    EXISTS (
      SELECT 1 FROM "${parent}" parent
      WHERE parent."id" = "${table}"."${fk}"
        AND parent."tenant_id" = ${expr}
    )`;
  return `
    CREATE POLICY "tenant_isolation" ON "${table}"
    USING (${cond})
    WITH CHECK (${cond})
  `;
}

export class FixRlsPoliciesEmptyTenantSetting1789400000000
  implements MigrationInterface
{
  name = 'FixRlsPoliciesEmptyTenantSetting1789400000000';

  private async rewrite(
    queryRunner: QueryRunner,
    expr: string,
  ): Promise<void> {
    for (const table of DIRECT_TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(directPolicy(table, expr));
    }
    for (const [table, parent, fk] of CHILD_TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(childPolicy(table, parent, fk, expr));
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, SAFE);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eski (xavfli) ifodaga qaytaradi — siyosatlarning o'zi joyida qoladi,
    // ya'ni izolyatsiya yo'qolmaydi, faqat bo'sh satr holati yana xato
    // tashlaydigan bo'ladi.
    await this.rewrite(queryRunner, OLD);
  }
}
