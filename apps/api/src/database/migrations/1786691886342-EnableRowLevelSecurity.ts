import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostgreSQL Row-Level Security (RLS) — himoya qatlami.
 *
 * Maqsad: agar ilova kodida (service metodida) tenant_id bo'yicha filtrlashni
 * unutib qo'yish xatosi bo'lsa ham, ma'lumotlar bazasining o'zi boshqa
 * tenant'ning yozuvlarini qaytarmasin/o'zgartirmasin.
 *
 * Yondashuv:
 *  1. Ilova uchun alohida, JADVAL EGASI BO'LMAGAN rol (`hotel_saas_app`)
 *     yaratiladi — migratsiya/seed operatsiyalari hamon egasi rol
 *     (masalan `hotel_saas`) orqali ishlaydi va RLS'dan mutlaqo ta'sirlanmaydi.
 *     Runtime ilova esa endi shu yangi rol orqali ulanadi (bu bilan
 *     "jadval egasi RLS'ni chetlab o'tadi" degan standart Postgres qoidasi
 *     bizga to'sqinlik qilmaydi — FORCE ROW LEVEL SECURITY kerak emas).
 *  2. Har bir so'rov (request) boshida ilova `SET LOCAL app.tenant_id = '<id>'`
 *     buyrug'ini bajaradi (RlsContextService orqali) — shu tranzaksiya
 *     doirasidagi barcha so'rovlar shu qiymat bilan filtrlanadi.
 *  3. Faqat operatsion (biznes) jadvallarga qo'llanildi: properties, guests,
 *     room_types, rooms, bookings, warehouse/stock/PO, pos, housekeeping,
 *     invoicing. Identity/auth jadvallari (tenants, users, roles,
 *     user_roles, permissions) BU BOSQICHDA ATAYLAB kiritilmadi — chunki
 *     login/register-tenant oqimlari hali autentifikatsiyadan oldin,
 *     tenant kontekstisiz shu jadvallarga murojaat qiladi (masalan
 *     subdomain bo'yicha tenant qidirish). Bu jadvallar uchun RLS keyingi
 *     bosqichda alohida (bootstrap-bypass) dizayn bilan qo'shiladi.
 */

const DIRECT_TENANT_TABLES = [
  'properties',
  'guests',
  'room_types',
  'rooms',
  'bookings',
  'warehouses',
  'suppliers',
  'stock_items',
  'stock_lots',
  'stock_transactions',
  'purchase_orders',
  'pos_outlets',
  'menu_items',
  'pos_orders',
  'housekeeping_tasks',
  'invoices',
];

// [jadval, FK ustuni, ota jadval] — tenant_id'ga ega bo'lmagan, lekin ota
// jadval orqali tenant'ga tegishli bo'lgan "farzand" jadvallar.
const CHILD_TABLES: Array<[string, string, string]> = [
  ['purchase_order_items', 'purchase_order_id', 'purchase_orders'],
  ['pos_order_items', 'order_id', 'pos_orders'],
  ['invoice_lines', 'invoice_id', 'invoices'],
  ['invoice_payments', 'invoice_id', 'invoices'],
];

const APP_ROLE = 'hotel_saas_app';

export class EnableRowLevelSecurity1786691886342 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1786691886342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Runtime uchun jadval egasi bo'lmagan rol.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE "${APP_ROLE}" LOGIN PASSWORD 'hotel_saas_app_dev';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`);
    // Kelajakda migratsiyalar orqali yaratiladigan yangi jadvallarga ham
    // avtomatik grant berilishi uchun (joriy migratsiya rolini asos qilib olib).
    await queryRunner.query(`
      DO $$
      BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"',
          current_user
        );
      END
      $$;
    `);

    // 2) To'g'ridan-to'g'ri tenant_id ustuniga ega jadvallar.
    for (const table of DIRECT_TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    // 3) tenant_id'siz, lekin ota jadval orqali tenant'ga bog'liq "farzand" jadvallar.
    for (const [table, fkColumn, parentTable] of CHILD_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (EXISTS (
          SELECT 1 FROM "${parentTable}" parent
          WHERE parent.id = "${table}"."${fkColumn}"
            AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM "${parentTable}" parent
          WHERE parent.id = "${table}"."${fkColumn}"
            AND parent.tenant_id = current_setting('app.tenant_id', true)::uuid
        ))
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table] of CHILD_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    for (const table of DIRECT_TENANT_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM "${APP_ROLE}"`);
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM "${APP_ROLE}"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${APP_ROLE}"',
          current_user
        );
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          DROP ROLE "${APP_ROLE}";
        END IF;
      END
      $$;
    `);
  }
}
