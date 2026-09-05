import { PermissionsService } from './permissions.service';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// 🔴 2026-09-05 — INTEGRATSION TESTDA TOPILGAN NUQSON UCHUN QO'RIQCHI.
//
// `permissions` — statik katalog, uni shu metod to'ldiradi. Bir muddat
// ilova rolida bu jadvalga `INSERT` huquqi yo'q edi
// (`EnableRowLevelSecurityBilling` uni eng kam huquq tamoyili bo'yicha
// olib tashlagan), va katalogni to'ldiradigan boshqa hech narsa ham
// yo'q edi. Natijada bo'sh bazada birinchi tenant ro'yxatdan o'ta
// olmasdi. Huquq faqat `INSERT` sifatida qaytarildi
// (`GrantPermissionCatalogueInsert`).
//
// DIQQAT — bu testlar mock bilan ishlaydi, ya'ni GRANT'ni tekshira
// OLMAYDI. Huquq tomonini `test/integration/rls-isolation.int-spec.ts`
// haqiqiy baza bilan qo'riqlaydi. Bu yerda esa mantiq: nima yoziladi,
// qachon yozilmaydi, va to'qnashuvga qanday munosabat.

const TOTAL =
  Object.values(PermissionModule).length *
  Object.values(PermissionAction).length;

function allPairs() {
  const rows: { module: PermissionModule; action: PermissionAction }[] = [];
  for (const module of Object.values(PermissionModule)) {
    for (const action of Object.values(PermissionAction)) {
      rows.push({ module, action });
    }
  }
  return rows;
}

function createService(rows: { module: string; action: string }[]) {
  const inserted: { values: unknown; ignored: boolean }[] = [];
  const qb = {
    insert: () => qb,
    into: () => qb,
    values: (v: unknown) => {
      inserted.push({ values: v, ignored: false });
      return qb;
    },
    orIgnore: () => {
      if (inserted.length) inserted[inserted.length - 1].ignored = true;
      return qb;
    },
    execute: jest.fn().mockResolvedValue({}),
  };
  const repo = {
    find: jest.fn().mockResolvedValue(rows),
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn(),
  };
  return { service: new PermissionsService(repo as never), repo, inserted, qb };
}

describe('PermissionsService', () => {
  it("katalog to'liq bo'lsa hech narsa yozmaydi", async () => {
    const { service, repo, inserted } = createService(allPairs());
    const res = await service.ensureAllPermissionsExist();

    expect(res).toHaveLength(TOTAL);
    expect(inserted).toHaveLength(0);
    // Ortiqcha o'qish ham bo'lmasin: bitta `find` yetarli.
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it("yetishmayotgan juftliklarni yozadi", async () => {
    const rows = allPairs().filter(
      (r) =>
        !(
          r.module === PermissionModule.PAYROLL &&
          r.action === PermissionAction.APPROVE
        ),
    );
    const { service, inserted } = createService(rows);
    await service.ensureAllPermissionsExist();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].values).toEqual([
      { module: PermissionModule.PAYROLL, action: PermissionAction.APPROVE },
    ]);
  });

  // 🔴 Bir vaqtda ikkita tenant ro'yxatdan o'tsa ikkalasi ham katalogni
  // to'ldirishga urinadi. `ON CONFLICT DO NOTHING` bo'lmasa, ikkinchisi
  // (module, action) noyoblik cheklovida yiqilardi — ya'ni bir vaqtning
  // o'zida ikkita mehmonxona ro'yxatdan o'tishga urinsa, biri xato
  // olardi.
  it("to'qnashuvda yiqilmaydi (ON CONFLICT DO NOTHING)", async () => {
    const { service, inserted } = createService([]);
    await service.ensureAllPermissionsExist();
    expect(inserted[0].ignored).toBe(true);
  });

  it("bo'sh bazada butun katalogni bir marta yozadi", async () => {
    const { service, inserted, qb } = createService([]);
    await service.ensureAllPermissionsExist();
    expect(inserted[0].values).toHaveLength(TOTAL);
    // Bitta so'rov — 65 ta alohida INSERT emas.
    expect(qb.execute).toHaveBeenCalledTimes(1);
  });
});
