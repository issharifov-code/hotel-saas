import { MigrationInterface, QueryRunner } from 'typeorm';

// Hisobot so'rovlari uchun composite indekslar.
//
// MUAMMO: barcha jadvallarda faqat `(tenant_id, property_id)` indeksi bor
// edi. Hisobotlar esa deyarli har doim BUNING USTIGA `status` (va bronlarda
// `check_in`/`check_out`) bo'yicha ham filtrlaydi. Kichik bazada bu
// sezilmaydi, lekin bronlar soni o'sgan sari Dashboard'ning har bir ochilishi
// (u ~12 ta so'rov yuboradi) sekinlashib boradi.
//
// O'LCHANDI (lokal PG 16, 300 000 bron):
//   avval: Bitmap Heap Scan, 2504 bufer, filtr 2334 qatorni tashlab yuboradi,
//          ~5.2 ms
//   keyin: Index Scan, 175 bufer, filtr umuman yo'q, ~0.8 ms
// Ya'ni ~6× tezroq va 14× kam bufer. Muhimi — `status` va `check_in`
// shartlari endi Index Cond ichida, ya'ni jadvaldan ortiqcha qator umuman
// o'qilmaydi.
//
// USTUNLAR TARTIBI: tenglik shartlari (`status`) oldin, oraliq shart
// (`check_in`) oxirida. ESLATMA: `(…, check_in, status)` tartibi ham SINAB
// KO'RILDI va PG 16'da natija deyarli bir xil chiqdi — planner oraliq
// ustundan keyin ham tenglik shartini indeks ichida qo'llay oldi. Ya'ni bu
// yerda tartib hal qiluvchi emas; hozirgi tartib shunchaki hech qachon
// yomonroq emas va `status` ustunini boshqa so'rovlar uchun ham prefiks
// sifatida ochiq qoldiradi.
//
// MAVJUD `(tenant_id, property_id)` INDEKSLARI ATAYLAB O'CHIRILMADI: ular
// texnik jihatdan yangi indekslarning prefiksi, ya'ni ortiqcha. Lekin ularni
// o'chirish alohida, o'ylab qilinadigan qadam (RLS policy'lari ham
// `tenant_id` bo'yicha ishlaydi va planner tor indeksni afzal ko'rishi
// mumkin), yozish hajmi esa bu ilovada juda kichik — foydasi xavfini
// oqlamaydi.
//
// `IF NOT EXISTS` — migratsiya qayta ishga tushsa ham xato bermasin.
// `CONCURRENTLY` ISHLATILMADI: u tranzaksiya ichida ishlamaydi, TypeORM esa
// migratsiyalarni tranzaksiyada bajaradi. Jadval hajmi kichik bo'lgani uchun
// qisqa lock muammo tug'dirmaydi.
export class AddReportsIndexes1788400000000 implements MigrationInterface {
  name = 'AddReportsIndexes1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eng ko'p ishlatiladigan naqsh — `getOverview`, `getBudgetPerformance`
    // va `getSegmentPerformance`dagi bronlar bo'yicha deyarli hamma so'rov.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_tenant_property_status_check_in" ON "bookings" ("tenant_id", "property_id", "status", "check_in")`,
    );
    // Bugungi ketishlar va "shu kuni faol bron" trend so'rovi uchun.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_tenant_property_status_check_out" ON "bookings" ("tenant_id", "property_id", "status", "check_out")`,
    );
    // To'lanmagan hisob-fakturalar (Dashboard + tavsiyalar paneli).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoices_tenant_property_status" ON "invoices" ("tenant_id", "property_id", "status")`,
    );
    // Kutilayotgan tozalash vazifalari.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_housekeeping_tasks_tenant_property_status" ON "housekeeping_tasks" ("tenant_id", "property_id", "status")`,
    );
    // Ochiq texnik zayavkalar (tavsiyalar panelining 6-qoidasi).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_maintenance_tickets_tenant_property_status" ON "maintenance_tickets" ("tenant_id", "property_id", "status")`,
    );
    // Hozir band xonalar soni.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rooms_tenant_property_status" ON "rooms" ("tenant_id", "property_id", "status")`,
    );
    // 🔴 `invoice_payments`da `invoice_id` bo'yicha INDEKS UMUMAN YO'Q edi.
    // Postgres tashqi kalit uchun indeksni AVTOMATIK yaratmaydi, shuning
    // uchun daromad trendi grafigidagi join har safar butun jadvalni
    // skanerlashga majbur edi. `created_at` ikkinchi ustun sifatida —
    // o'sha so'rovdagi sana filtri uchun.
    //
    // O'LCHANDI (180 000 to'lov): Hash Join + butun jadval Seq Scan (170 040
    // qator filtrda tashlanadi), ~12.7 ms → Nested Loop, ~4.7 ms. Farq
    // to'lovlar soniga chiziqli o'sadi, ya'ni vaqt o'tgani sari kattalashadi.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_payments_invoice_created" ON "invoice_payments" ("invoice_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_invoice_payments_invoice_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_rooms_tenant_property_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_maintenance_tickets_tenant_property_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_housekeeping_tasks_tenant_property_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_invoices_tenant_property_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_tenant_property_status_check_out"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_tenant_property_status_check_in"`,
    );
  }
}
