import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 📊 KUZATUV (2026-09-05). Production'da xato yuz berganda uning yagona
// izi Render'ning oqim loglari edi: qidirish qiyin, saqlash muddati
// cheklangan, va deploy'dan keyin amalda yo'qoladi. Ya'ni "o'tgan hafta
// bir foydalanuvchi xato ko'rgan" degan xabarni tekshirishning iloji
// yo'q edi.
//
// Bu jadval 5xx xatolarni kontekst bilan saqlaydi. U ATAYLAB oddiy:
// tashqi xizmat (Sentry va h.k.) qo'shilsa yaxshi bo'lardi, lekin u
// yangi bog'liqlik, yangi hisob va yangi sir talab qiladi — bu esa
// hozirgi bosqichda ortiqcha. Jadval yechimi hech qanday tashqi
// bog'liqliksiz "nima buzildi?" savoliga javob beradi.
//
// XAVFSIZLIK. Jadvalda RLS bor, lekin odatdagi tenant izolyatsiyasi
// EMAS: o'qish uchun `app.error_log_bypass` aniq yoqilishi shart
// (`ErrorEventsService`), yozish esa har doim ruxsat etilgan. Sabab:
// (a) xato yozuvlari platforma darajasidagi ma'lumot va tenantga
// ko'rsatilmaydi; (b) ular tenantsiz so'rovlardan ham keladi
// (`tenant_id IS NULL`), ya'ni oddiy `tenant_id = ...` siyosati ularni
// hech kimga ko'rsatmasdi; (c) auditda aynan "yangi jadval huquqni
// avtomatik oladi, himoyani esa olmaydi" fail-open naqshi topilgan
// edi — bu yerda teskarisi qilinadi.
@Entity('error_events')
export class ErrorEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // `RequestIdMiddleware` bergan ID — log qatorlari, xato javobi va shu
  // yozuv aynan shu qiymat orqali bog'lanadi.
  @Column({ name: 'request_id', length: 64 })
  requestId: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode: number;

  @Column({ length: 10 })
  method: string;

  // Marshrut NAQSHI emas, haqiqiy yo'l — lekin query string OLIB
  // TASHLANADI (`ErrorEventsService`), chunki unda shaxsiy ma'lumot
  // bo'lishi mumkin.
  @Column({ length: 500 })
  path: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  // Xato sinfining nomi (`TypeORMError`, `TypeError` ...) — guruhlash
  // uchun eng foydali qisqa belgi.
  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text' })
  message: string;

  // Stack ixtiyoriy: HttpException'larda u ko'pincha foydasiz.
  @Column({ type: 'text', nullable: true })
  stack: string | null;

  // Bir xil xatolarni guruhlash uchun barqaror xesh (metod + marshrut
  // shakli + xato nomi + xabarning normallashtirilgan shakli).
  @Column({ length: 64 })
  fingerprint: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
