import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// Xabar kanali — Guest.communicationPreference bilan mos: EMAIL/SMS haqiqiy
// yozma xabar kanali, PHONE (qo'ng'iroq) va NONE (aloqa yo'q) xabar yuborish
// uchun mos emas — shu ikkalasida MessagingService aniq channel override
// talab qiladi (guard: pastga qarang, MessagingService.resolveChannel).
export enum MessageChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

// Kelajakda avtomatik yuborish uchun tayyor maydon — hozircha faqat
// kategoriyalash/filtrlash uchun ishlatiladi, xuddi Guest.communicationPreference
// avval "hozircha faqat saqlanadi" bo'lgani kabi. V1'da xabarlar FAQAT
// xodim tomonidan qo'lda yuboriladi (booking/night-audit zanjiriga
// avtomatik ulanish yo'q) — bu ataylab additive/kam-ta'sirli qaror.
export enum MessageTriggerType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CUSTOM = 'custom',
}

// Xabar shabloni — tenant/property darajasida, xodim qayta-qayta ishlatishi
// uchun. `bodyTemplate` ichida oddiy `{{guestName}}`, `{{propertyName}}`,
// `{{checkIn}}`, `{{checkOut}}`, `{{roomNumber}}` o'rin-bosarlar qo'llab-quvvatlanadi
// (MessagingService.renderTemplate orqali, faqat string almashtirish — hech
// qanday tashqi shablon dvigateli kerak emas).
@Entity('message_templates')
@Index(['tenantId', 'propertyId'])
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ length: 200 })
  name: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: MessageTriggerType,
    default: MessageTriggerType.CUSTOM,
  })
  triggerType: MessageTriggerType;

  @Column({ type: 'enum', enum: MessageChannel })
  channel: MessageChannel;

  // Faqat EMAIL kanali uchun ma'noli — SMS'da e'tiborga olinmaydi.
  @Column({ length: 200, nullable: true, type: 'varchar' })
  subject: string | null;

  @Column({ name: 'body_template', type: 'varchar', length: 4000 })
  bodyTemplate: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
