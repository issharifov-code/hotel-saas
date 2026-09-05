import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Regressiya qo'riqchisi (2026-09-05).
//
// `set_config('app.tenant_id', ..., true)` tranzaksiyaga xos. Tranzaksiya
// tugagach PostgreSQL GUC'ni oldingi qiymatiga qaytaradi — hech qachon
// global o'rnatilmagan maxsus GUC uchun bu NULL emas, BO'SH SATR. Ya'ni
// pool ulanishi qayta ishlatilganda:
//
//   current_setting('app.tenant_id', true) -> ''   va   ''::uuid -> XATO
//
// Natijada RLS "0 qator" o'rniga 500 qaytaradi. Yechim — har doim
// `NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
//
// Migratsiya 1789400000000 mavjud 49 ta siyosatning hammasini shu ko'rinishga
// o'tkazdi. Bu test undan KEYIN qo'shiladigan migratsiyalar eski (xavfli)
// ifodani qaytarib olib kelmasligini tekshiradi.
//
// Eski migratsiyalar ataylab tekshirilmaydi: ular tarix, va ularning
// natijasi 1789400000000 tomonidan allaqachon tuzatilgan.
const FIX_TIMESTAMP = 1789400000000;

const MIGRATIONS_DIR = join(__dirname, 'migrations');

// `NULLIF(` bilan boshlanmaydigan `current_setting('app.tenant_id'...`
const UNSAFE = /current_setting\(\s*'app\.tenant_id'/g;

function isWrappedInNullif(source: string, index: number): boolean {
  // Ifodadan oldingi 10 belgi ichida `NULLIF(` turgan bo'lishi kerak.
  return source.slice(Math.max(0, index - 10), index).includes('NULLIF(');
}

describe('RLS migratsiyalari', () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => Number(f.split('-')[0]) > FIX_TIMESTAMP);

  it(`1789400000000 dan keyingi migratsiyalar app.tenant_id ni NULLIF bilan o'qiydi`, () => {
    const buzilganlar: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      for (const match of source.matchAll(UNSAFE)) {
        if (!isWrappedInNullif(source, match.index)) {
          buzilganlar.push(file);
          break;
        }
      }
    }

    expect(buzilganlar).toEqual([]);
  });

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Boshlang'ich RLS
  // migratsiyasidagi `ALTER DEFAULT PRIVILEGES` har YANGI jadvalga
  // avtomatik DML berardi, RLS siyosati esa alohida qo'lda qadam edi —
  // ya'ni jadval qo'shish FAIL-OPEN: huquq o'z-o'zidan keladi, himoya
  // esa kelmaydi. Aynan shu sababdan `subscription_invoices` (tenant_id
  // ustuni bor, moliyaviy jadval) va `demo_requests` RLS'siz qolib
  // ketgan edi.
  //
  // Migratsiya 1789600000000 o'sha avtomatik huquqni bekor qildi. Endi
  // yangi jadval yaratgan migratsiya GRANT'ni ham o'zi berishi kerak —
  // bu test buni unutib qo'yilmasligini ta'minlaydi.
  const GRANT_FIX_TIMESTAMP = 1789600000000;

  it('1789600000000 dan keyin CREATE TABLE qilgan migratsiya GRANT ham beradi', () => {
    const after = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => Number(f.split('-')[0]) > GRANT_FIX_TIMESTAMP);

    const buzilganlar: string[] = [];
    for (const file of after) {
      const source = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const createsTable = /CREATE TABLE/i.test(source);
      if (!createsTable) continue;
      // Rol nomi to'g'ridan-to'g'ri yozilishi ham, konstanta orqali
      // berilishi ham mumkin (`const APP_ROLE = 'hotel_saas_app'` +
      // `TO "${APP_ROLE}"`). Ikkinchisi ko'proq uchraydi va bir xil
      // ma'noni beradi, shuning uchun konstanta avval ochib olinadi.
      const roleConst = /const\s+APP_ROLE\s*=\s*'hotel_saas_app'/.test(source)
        ? source.replace(/\$\{APP_ROLE\}/g, 'hotel_saas_app')
        : source;
      const grants = /GRANT[\s\S]{0,200}?hotel_saas_app/i.test(roleConst);
      if (!grants) buzilganlar.push(file);
    }

    expect(buzilganlar).toEqual([]);
  });

  it('tuzatuvchi migratsiyaning oʻzi mavjud va NULLIF ishlatadi', () => {
    const fix = readdirSync(MIGRATIONS_DIR).find((f) =>
      f.startsWith(String(FIX_TIMESTAMP)),
    );
    expect(fix).toBeDefined();

    const source = readFileSync(join(MIGRATIONS_DIR, fix as string), 'utf8');
    expect(source).toContain(
      `NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    );
  });
});
