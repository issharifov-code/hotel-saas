import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Foydalanuvchi "e'tiborga oldim" deb yopgan tavsiya.
//
// NIMA UCHUN FOYDALANUVCHI BO'YICHA (mulk bo'yicha emas): tavsiyalar turli
// rollarga qaratilgan (moliya, front desk, texnik xizmat). Direktor
// "3 ta zayavka ochiq"ni yopsa, texnik xizmat xodimi uni ko'rmay qolmasligi
// kerak. Shuning uchun yopish faqat yopgan odamning ko'rinishiga ta'sir qiladi.
//
// NIMA UCHUN `severity` SAQLANADI: yopilgan tavsiya holat YOMONLASHSA
// qaytadan chiqishi kerak. Masalan "2 ta zayavka ochiq" (info) yopilgan
// bo'lsa-da, ular 7 taga chiqib `warning`ga aylansa — bu yangi xabar, uni
// yashirish xavfli. Solishtirish `getInsights` ichida (severity darajasi
// bo'yicha) qilinadi.
//
// Bu — Reports modulining O'Z entity'si. Modul boshqa modullarning
// entity'lariga faqat o'qish uchun ulanadi, bu esa shu qoidadan istisno emas:
// jadval Reports'ga tegishli, shuning uchun unga yozish ham shu yerda.
@Entity('insight_dismissals')
@Index(['tenantId', 'propertyId'])
@Unique(['userId', 'propertyId', 'insightId'])
export class InsightDismissal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // `InsightDto.id` — barqaror kalit ('occupancy-trend', 'budget-variance', ...).
  // Enum emas, matn: yangi qoida qo'shilganda migratsiya kerak bo'lmasin.
  @Column({ name: 'insight_id', type: 'varchar', length: 64 })
  insightId: string;

  // Yopilgan paytdagi jiddiylik darajasi — yuqoridagi izohga qarang.
  @Column({ type: 'varchar', length: 16 })
  severity: string;

  // Yopilish vaqti. Yopish MUDDATLI (qarang INSIGHT_DISMISSAL_DAYS):
  // "abadiy yashirish" haqiqiy muammoni ko'zdan butunlay yo'qotardi.
  @Column({ name: 'dismissed_at', type: 'timestamp' })
  dismissedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
