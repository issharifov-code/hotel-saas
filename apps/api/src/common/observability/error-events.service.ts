import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { ErrorEvent } from './entities/error-event.entity';
import { PaginatedResult, parsePagination } from '../utils/pagination.util';

// Saqlash muddati — migratsiyadagi RLS siyosati bilan bir xil bo'lishi
// SHART. Bu yerdagi qiymat kichikroq bo'lsa tozalash hech narsa
// o'chirmaydi (siyosat rad etadi), kattaroq bo'lsa ham xavfsiz.
export const RETENTION_DAYS = 30;

// Bitta xil xato (bir xil `fingerprint`) daqiqasiga ko'pi bilan shuncha
// marta YOZILADI. Sabab: takrorlanuvchi xato (masalan har so'rovda
// yiqiladigan endpoint) sekundiga o'nlab qator yozib, 256MB'lik bazani
// to'ldirib qo'yishi mumkin. Chegaradan oshgani BAZAGA yozilmaydi,
// lekin STDOUT'ga baribir chiqadi — ya'ni hech narsa jimgina yo'qolmaydi.
const MAX_WRITES_PER_FINGERPRINT_PER_MINUTE = 10;
const FLOOD_WINDOW_MS = 60_000;
// Naqshlar xotirasi cheksiz o'smasin.
const FLOOD_MAP_MAX = 500;

export interface RecordErrorInput {
  requestId: string;
  statusCode: number;
  method: string;
  path: string;
  tenantId: string | null;
  userId: string | null;
  name: string;
  message: string;
  stack?: string | null;
}

/**
 * Yo'ldagi o'zgaruvchan qismlarni almashtiradi, shunda bir xil xato bir
 * xil `fingerprint` oladi: `/api/bookings/<uuid>/check-in` va boshqa
 * bronning o'sha yo'li — bitta guruh.
 */
export function normalizePathForFingerprint(path: string): string {
  return path
    .split('?')[0]
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    )
    .replace(/\/\d+/g, '/:n');
}

/**
 * Xabardagi o'zgaruvchan qismlarni ham olib tashlaydi (id'lar, raqamlar,
 * qo'shtirnoq ichidagi qiymatlar) — aks holda har bir xato o'z guruhini
 * ochib yuborardi va guruhlashning ma'nosi qolmasdi.
 */
export function normalizeMessageForFingerprint(message: string): string {
  return message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<id>',
    )
    .replace(/\d+/g, '<n>')
    .slice(0, 200);
}

export function buildFingerprint(input: {
  method: string;
  path: string;
  name: string;
  message: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.method,
        normalizePathForFingerprint(input.path),
        input.name,
        normalizeMessageForFingerprint(input.message),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 64);
}

// Tozalash oralig'i. `@nestjs/schedule` ATAYLAB qo'shilmadi: bitta
// sutkalik ish uchun yangi bog'liqlik ortiqcha, oddiy `setInterval`
// yetarli. Ko'p instansiyada bir necha marta ishlashi zararsiz —
// DELETE idempotent.
const PRUNE_INTERVAL_MS = 24 * 3_600_000;

@Injectable()
export class ErrorEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErrorEventsService.name);
  private readonly floodCounters = new Map<
    string,
    { windowStart: number; count: number }
  >();
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ErrorEvent)
    private readonly errorRepo: Repository<ErrorEvent>,
  ) {}

  onModuleInit(): void {
    // Testlarda taymer ishga tushmasligi kerak — aks holda Jest
    // jarayoni "ochiq handle" bilan osilib qolardi.
    if (process.env.NODE_ENV === 'test') return;
    this.pruneTimer = setInterval(() => {
      void this.pruneOld()
        .then((n) => {
          if (n > 0) this.logger.log(`Eski xato yozuvlari tozalandi: ${n} ta`);
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `Xato yozuvlarini tozalab bo'lmadi: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }, PRUNE_INTERVAL_MS);
    // Node jarayonini shu taymer tirik ushlab turmasin.
    this.pruneTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = null;
  }

  /**
   * Xato yozuvini saqlaydi.
   *
   * DIQQAT — bu metod ATAYLAB so'rovning o'z tranzaksiyasidan TASHQARIDA
   * ishlaydi. `errorRepo` oddiy pool ulanishidan foydalanadi (RLS
   * request-scoped repository EMAS), chunki so'rov tranzaksiyasi xato
   * sababli rollback qilinadi — yozuv ham u bilan birga yo'qolardi.
   *
   * NIMA UCHUN YOZISHDA HAM `withBypass`. Jadvalning INSERT siyosati
   * `WITH CHECK (true)`, ya'ni yozishning o'zi bypass talab qilmaydi.
   * LEKIN TypeORM `INSERT ... RETURNING "id"` yuboradi, PostgreSQL esa
   * `RETURNING` uchun yangi qatorni O'QISH huquqini ham talab qiladi —
   * va o'qish siyosati bypass'siz rad etadi. Bu jonli sinovda
   * aniqlangan: unit testda repository mock bo'lgani uchun ko'rinmagan
   * ("new row violates row-level security policy"). Bypass bu yerda
   * xavfsizlikni pasaytirmaydi — u faqat shu tranzaksiyada amal qiladi
   * va tenant yo'llaridan kelgan tasodifiy so'rov baribir 0 qator
   * ko'radi.
   */
  async record(input: RecordErrorInput): Promise<string | null> {
    const fingerprint = buildFingerprint(input);
    if (!this.allowWrite(fingerprint)) return null;

    try {
      const saved = await this.withBypass((m) => {
        const repo = m.getRepository(ErrorEvent);
        return repo.save(
          repo.create({
            requestId: input.requestId,
            statusCode: input.statusCode,
            method: input.method.slice(0, 10),
            // Query string OLIB TASHLANADI: unda mehmon ismi, telefon
            // yoki qidiruv matni bo'lishi mumkin va u xato tahliliga
            // kerak emas.
            path: input.path.split('?')[0].slice(0, 500),
            tenantId: input.tenantId,
            userId: input.userId,
            name: input.name.slice(0, 200),
            message: input.message,
            stack: input.stack ?? null,
            fingerprint,
          }),
        );
      });
      return saved.id;
    } catch (err) {
      // Xato jurnalining o'zi so'rovni yiqitmasligi kerak — bu eng
      // yomon natija bo'lardi. Faqat log.
      this.logger.error(
        `Xato yozuvini saqlab bo'lmadi: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private allowWrite(fingerprint: string): boolean {
    const now = Date.now();
    const entry = this.floodCounters.get(fingerprint);
    if (!entry || now - entry.windowStart >= FLOOD_WINDOW_MS) {
      if (this.floodCounters.size >= FLOOD_MAP_MAX) this.floodCounters.clear();
      this.floodCounters.set(fingerprint, { windowStart: now, count: 1 });
      return true;
    }
    entry.count += 1;
    if (entry.count === MAX_WRITES_PER_FINGERPRINT_PER_MINUTE + 1) {
      this.logger.warn(
        `Xato juda tez takrorlanmoqda (fingerprint ${fingerprint.slice(0, 12)}) — bazaga yozish shu daqiqa uchun to'xtatildi, loglar davom etadi`,
      );
    }
    return entry.count <= MAX_WRITES_PER_FINGERPRINT_PER_MINUTE;
  }

  // O'qish `app.error_log_bypass` ANIQ yoqilgan tranzaksiyada bo'ladi —
  // migratsiyadagi RLS siyosati aynan shuni talab qiladi. Ya'ni bu
  // jadvalga tasodifiy (masalan kelajakda qo'shilgan tenant yo'lidan)
  // murojaat 0 qator qaytaradi, xato emas.
  private async withBypass<T>(
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.errorRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.error_log_bypass',
        'on',
      ]);
      return fn(manager);
    });
  }

  async list(
    page?: string,
    pageSize?: string,
  ): Promise<PaginatedResult<ErrorEvent>> {
    const { skip, take, ...meta } = parsePagination(page, pageSize, 50, 200);
    const [items, total] = await this.withBypass((m) =>
      m.getRepository(ErrorEvent).findAndCount({
        order: { occurredAt: 'DESC' },
        skip,
        take,
      }),
    );
    return { items, total, ...meta };
  }

  /**
   * Xatolarni guruhlab, eng ko'p uchraganini birinchi qaytaradi —
   * "hozir nima buzilgan?" degan savolga aynan shu javob beradi, xom
   * ro'yxat emas.
   */
  async summary(sinceHours = 24): Promise<
    {
      fingerprint: string;
      count: number;
      lastSeen: Date;
      name: string;
      message: string;
      method: string;
      path: string;
      statusCode: number;
    }[]
  > {
    const since = new Date(Date.now() - sinceHours * 3_600_000);
    return this.withBypass((m) =>
      m.query(
        `
        SELECT DISTINCT ON (e."fingerprint")
          e."fingerprint",
          c."count"::int AS "count",
          e."occurred_at" AS "lastSeen",
          e."name",
          e."message",
          e."method",
          e."path",
          e."status_code" AS "statusCode"
        FROM "error_events" e
        JOIN (
          SELECT "fingerprint", count(*) AS "count"
          FROM "error_events"
          WHERE "occurred_at" >= $1
          GROUP BY "fingerprint"
        ) c ON c."fingerprint" = e."fingerprint"
        WHERE e."occurred_at" >= $1
        ORDER BY e."fingerprint", e."occurred_at" DESC
        `,
        [since],
      ),
    ).then((rows: Record<string, unknown>[]) =>
      // `DISTINCT ON` guruh bo'yicha tartiblashni talab qiladi, shuning
      // uchun yakuniy tartib (ko'pdan ozga) shu yerda beriladi.
      (rows as never[]).sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count,
      ),
    );
  }

  /**
   * Saqlash muddatidan eski yozuvlarni o'chiradi. Bazadagi RLS siyosati
   * ham xuddi shu kesimni talab qiladi, ya'ni bu yerdagi shart
   * buzilsa ham yaqin kunlardagi yozuvlar saqlanib qoladi.
   */
  async pruneOld(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const result = await this.withBypass((m) =>
      m.getRepository(ErrorEvent).delete({ occurredAt: LessThan(cutoff) }),
    );
    return result.affected ?? 0;
  }
}
