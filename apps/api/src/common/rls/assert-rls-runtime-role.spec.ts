import { assertRlsRuntimeRole } from './assert-rls-runtime-role';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, L5). Tenant izolyatsiyasi ilova
// jadval EGASI BO'LMAGAN rol bilan ulanishiga tayanadi — PostgreSQL
// egaga RLS qo'llamaydi. `DB_APP_USERNAME` egaga yo'naltirilsa barcha
// siyosatlar JIMGINA kuchsizlanadi: xato ham, log ham, yiqilgan test ham
// bo'lmaydi, so'rovlar shunchaki barcha tenantlarni qaytara boshlaydi.
//
// Bu testlar shu jim buzilish shovqinli bo'lib qolishini kafolatlaydi.
describe('assertRlsRuntimeRole', () => {
  it("ega bo'lmagan, BYPASSRLS'siz rol uchun o'tadi", () => {
    expect(() =>
      assertRlsRuntimeRole({
        currentUser: 'hotel_saas_app',
        bypassRls: false,
        ownedTables: 0,
      }),
    ).not.toThrow();
  });

  it('rol jadval egasi bo\'lsa ishga tushishni to\'xtatadi', () => {
    expect(() =>
      assertRlsRuntimeRole({
        currentUser: 'hotel_saas',
        bypassRls: false,
        ownedTables: 51,
      }),
    ).toThrow(/egasi/);
  });

  it("rol BYPASSRLS ga ega bo'lsa ishga tushishni to'xtatadi", () => {
    expect(() =>
      assertRlsRuntimeRole({
        currentUser: 'postgres',
        bypassRls: true,
        ownedTables: 0,
      }),
    ).toThrow(/BYPASSRLS/);
  });

  it("xato xabari qaysi rol ekanini aytadi (diagnostika uchun)", () => {
    expect(() =>
      assertRlsRuntimeRole({
        currentUser: 'notogri_rol',
        bypassRls: false,
        ownedTables: 3,
      }),
    ).toThrow(/notogri_rol/);
  });
});
