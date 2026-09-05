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
        if (!isWrappedInNullif(source, match.index as number)) {
          buzilganlar.push(file);
          break;
        }
      }
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
