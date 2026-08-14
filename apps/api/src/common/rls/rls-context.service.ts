import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

interface RequestWithUser {
  user?: AuthenticatedUser;
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
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    }
    // tenantId bo'lmasa (masalan platforma admin yoki hali autentifikatsiya
    // qilinmagan holat), `app.tenant_id` o'rnatilmay qoladi — RLS siyosati
    // `current_setting(..., true)` NULL qaytaradi va `tenant_id = NULL`
    // hech qachon rost bo'lmaydi, ya'ni HAMMA qatorlar berkitiladi
    // (xavfsiz standart — "aniq tenant yo'q bo'lsa, hech narsa ko'rinmasin").
    this.tenantContextApplied = true;
  }

  async commit(): Promise<void> {
    if (!this.queryRunner) return;
    try {
      await this.queryRunner.commitTransaction();
    } finally {
      await this.queryRunner.release();
      this.queryRunner = null;
    }
  }

  async rollback(): Promise<void> {
    if (!this.queryRunner) return;
    try {
      await this.queryRunner.rollbackTransaction();
    } finally {
      await this.queryRunner.release();
      this.queryRunner = null;
    }
  }
}
