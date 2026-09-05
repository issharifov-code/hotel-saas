import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface VersionInfo {
  // Ishlab turgan kodning kommit SHA'si. Render `RENDER_GIT_COMMIT` ni
  // avtomatik beradi; mahalliy ishga tushirishda 'unknown'.
  commit: string;
  // Jarayon qachon ko'tarilgani — deploy vaqti bilan amalda bir xil.
  startedAt: string;
  uptimeSeconds: number;
  // Bazaga oxirgi qo'llangan migratsiyaning timestamp'i (masalan
  // 1789500000000). Migratsiya nomi ATAYLAB qaytarilmaydi: timestamp
  // savolga to'liq javob beradi ("falon migratsiya qo'llanganmi"), lekin
  // ichki nomlash sxemasini oshkor qilmaydi.
  schemaVersion: number | null;
}

// 🔴 Nima uchun bu endpoint bor (2026-09-05).
//
// Migratsiyalar Render'da `buildCommand` ichida ishlaydi. Agar migratsiya
// yiqilsa, deploy ham yiqiladi va Render ESKI versiyani xizmat qilishda
// davom etadi — ya'ni "sayt ishlayapti" o'z-o'zidan yangi kommit
// chiqqanini ISBOTLAMAYDI. Ilgari buni tashqaridan aniqlashning iloji
// yo'q edi: har bir deploy'dan keyin Render panelini qo'lda ochish kerak
// bo'lardi.
//
// Endi bitta so'rov ikkala savolga javob beradi: qaysi KOD ishlayapti va
// qaysi SXEMA ostida.
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startedAt = new Date();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getVersion(): Promise<VersionInfo> {
    return {
      commit:
        process.env.RENDER_GIT_COMMIT ??
        process.env.GIT_COMMIT ??
        process.env.SOURCE_VERSION ??
        'unknown',
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor(
        (Date.now() - this.startedAt.getTime()) / 1000,
      ),
      schemaVersion: await this.getSchemaVersion(),
    };
  }

  // Baza javob bermasa ham endpoint 500 qaytarmasligi kerak — u aynan
  // "nima bo'lyapti?" deb qaraladigan joy. Shu sababli xato yutiladi va
  // `null` qaytadi (logda esa ko'rinadi).
  private async getSchemaVersion(): Promise<number | null> {
    try {
      const rows = await this.dataSource.query<{ timestamp: string }[]>(
        'SELECT "timestamp" FROM "migrations" ORDER BY "timestamp" DESC LIMIT 1',
      );
      if (!rows.length) return null;
      return Number(rows[0].timestamp);
    } catch (err) {
      this.logger.warn(
        `Sxema versiyasini o'qib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
