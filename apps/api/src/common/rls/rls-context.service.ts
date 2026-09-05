import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

interface ResponseLike {
  once?: (event: string, listener: () => void) => unknown;
}

interface RequestWithUser {
  user?: AuthenticatedUser;
  // Express `req.res` — javob tugaganini eshitish uchun (pastdagi
  // `open()` izohiga qarang).
  res?: ResponseLike;
}

/**
 * Har bir HTTP so'rov uchun BITTA (lazy) tranzaksiya/ulanish ochadi va
 * shu tranzaksiya boshida `SET LOCAL app.tenant_id` orqali joriy
 * foydalanuvchining tenant'ini PostgreSQL sessiyasiga yozadi — shu orqali
 * Row-Level Security siyosatlari (EnableRowLevelSecurity migratsiyasi)
 * ishlaydi.
 *
 * REQUEST scope: bitta so'rov davomida RlsModule.forFeature() orqali
 * ro'yxatdan o'tgan barcha repository'lar SHU BITTA instance orqali
 * (demak bitta ulanish/tranzaksiya orqali) ishlaydi.
 *
 * Ulanish/tranzaksiya haqiqatda faqat BIRINCHI marta `getManager()`
 * chaqirilganda ochiladi (masalan, so'rov faqat auth/roles kabi RLS'ga
 * kirmaydigan jadvallar bilan ishlasa, hech qanday qo'shimcha ulanish
 * band qilinmaydi).
 */
@Injectable({ scope: Scope.REQUEST })
export class RlsContextService {
  private queryRunner: QueryRunner | null = null;
  private managerPromise: Promise<EntityManager> | null = null;
  private tenantContextApplied = false;

  constructor(
    @Inject(REQUEST) private readonly request: RequestWithUser,
    private readonly dataSource: DataSource,
  ) {}

  async getManager(): Promise<EntityManager> {
    if (!this.managerPromise) {
      this.managerPromise = this.open();
    }
    return this.managerPromise;
  }

  private async open(): Promise<EntityManager> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    this.queryRunner = queryRunner;

    // 🔴 2026-09-05 (kod auditi): tranzaksiya OCHILIB QOLIB KETARDI.
    //
    // `RlsModule.forFeature` factory'si `await rlsContext.getManager()` ni
    // repository YARATILAYOTGAN paytda chaqiradi — ya'ni Nest so'rov
    // subtree'sini qurayotganda, GUARD'LARDAN OLDIN. Commit/rollback esa
    // faqat `RlsTransactionInterceptor` da, interceptor'lar esa guard'lardan
    // KEYIN ishlaydi. Demak guard 401/403 tashlasa, interceptor umuman
    // chaqirilmaydi va tranzaksiya ham, pool ulanishi ham bo'shatilmasdan
    // qolardi. (Interceptor izohidagi "guard 401/403 qaytarsa bu no-op"
    // degan gap shu sababdan noto'g'ri edi.) Ketma-ket kelgan bir necha
    // yuz 403 ulanishlar hovuzini tugatib qo'yishi mumkin edi.
    //
    // Yechim — javob tugashini eshitish: nima bo'lishidan qat'i nazar
    // (guard rad etdi, so'rov uzildi, timeout) ulanish qaytariladi. Agar
    // interceptor allaqachon commit/rollback qilgan bo'lsa, `queryRunner`
    // null bo'ladi va bu no-op.
    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low — L10). `void this.rollback()`
    // `.catch` siz edi: mijoz so'rovni yarmida uzsa yoki `close` hodisasi
    // `commitTransaction()` bilan `release()` orasidagi oynaga tushsa,
    // `rollbackTransaction()` faol bo'lmagan tranzaksiyada xato tashlardi
    // va bu ushlanmagan promise rejection bo'lardi — Node >= 15 da butun
    // jarayonni tugatadi. Ya'ni bitta uzilgan so'rov API'ni yiqitishi
    // mumkin edi.
    this.request.res?.once?.('close', () => {
      void this.rollback().catch(() => {
        // Ataylab jim: bu yerda qila oladigan ish yo'q va bu yo'l
        // faqat tranzaksiya allaqachon yopilgan holatda ishlaydi.
      });
    });

    return queryRunner.manager;
  }

  /**
   * `app.tenant_id` sessiya o'zgaruvchisini JORIY `request.user`ga qarab
   * o'rnatadi (yoki tozalab qo'yadi). `RlsTransactionInterceptor` buni HAR
   * SO'ROVDA, Guard'lar (JwtAuthGuard va h.k.) `request.user`ni to'ldirib
   * bo'lgandan KEYIN, lekin haqiqiy handler/repository so'rovlari
   * boshlanishidan OLDIN chaqiradi.
   *
   * MUHIM SABAB: `RlsModule.forFeature()` orqali yaratilgan repository'lar
   * REQUEST-scoped bo'lgani uchun, ularga bog'liq controller/servis ham
   * avtomatik ravishda REQUEST-scoped bo'lib qoladi — va Nest bunday
   * controller'ning BUTUN DI subtree'sini (demak shu repository'larni,
   * demak `getManager()`ni, demak tranzaksiyani) so'rov CONTEKSTI
   * yaratilishi chog'ida, ya'ni Guard'lar ISHGA TUSHISHIDAN OLDIN,
   * oldindan hal qiladi. Shu sabab avvalgi versiyada tranzaksiya ochilgan
   * paytda `request.user` hali `undefined` bo'lgan va `set_config` HECH
   * QACHON chaqirilmagan (RLS "aniq tenant yo'q" holatini xavfsiz standart
   * sifatida hamma qatorlarni berkitib qo'ygan). Shu funksiya bu muammoni
   * hal qiladi — tranzaksiya qachon ochilganidan qat'iy nazar, tenant
   * konteksti Guard'lardan KEYIN, haqiqiy so'rovlardan OLDIN o'rnatiladi.
   */
  async applyTenantContext(): Promise<void> {
    if (this.tenantContextApplied) return;
    // RLS orqali hech qanday repository ishlatilmagan bo'lsa (masalan auth
    // yoki faqat rollar bilan ishlaydigan so'rov) — hech narsa qilinmaydi,
    // qo'shimcha ulanish band qilinmaydi (laziness saqlanadi).
    if (!this.managerPromise) return;

    const manager = await this.getManager();
    const tenantId = this.request.user?.tenantId ?? null;
    if (tenantId) {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.tenant_id',
        tenantId,
      ]);
    }
    // tenantId bo'lmasa (masalan platforma admin yoki hali autentifikatsiya
    // qilinmagan holat), `app.tenant_id` o'rnatilmay qoladi — RLS siyosati
    // `current_setting(..., true)` NULL qaytaradi va `tenant_id = NULL`
    // hech qachon rost bo'lmaydi, ya'ni HAMMA qatorlar berkitiladi
    // (xavfsiz standart — "aniq tenant yo'q bo'lsa, hech narsa ko'rinmasin").
    this.tenantContextApplied = true;
  }

  // `queryRunner` maydoni AWAIT'dan OLDIN tozalanadi: aks holda
  // `commitTransaction()` kutilayotgan paytda kelgan `close` hodisasi
  // `rollback()` ni ishga tushirib, o'sha tranzaksiyani ikkinchi marta
  // yopishga urinardi (L10).
  async commit(): Promise<void> {
    const runner = this.queryRunner;
    if (!runner) return;
    this.queryRunner = null;
    try {
      await runner.commitTransaction();
    } finally {
      await runner.release();
    }
  }

  async rollback(): Promise<void> {
    const runner = this.queryRunner;
    if (!runner) return;
    this.queryRunner = null;
    try {
      await runner.rollbackTransaction();
    } finally {
      await runner.release();
    }
  }
}
