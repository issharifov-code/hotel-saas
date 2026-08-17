import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantPlan } from '../../tenants/entities/tenant.entity';

export enum SubscriptionInvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

// SaaS platformasining o'zi tenant'lardan (mehmonxonalardan) obuna to'lovi
// undirishi uchun hisob-faktura — bu `invoices` (mehmon folio) moduli bilan
// ALOQADOR EMAS, butunlay boshqa maqsad (platforma <-> tenant, mehmon emas).
//
// Bu jadval ATAYLAB RLS'siz (`TypeOrmModule.forFeature`, `RlsModule.forFeature`
// EMAS) — chunki platforma admin (tenantId=null) barcha tenant'lar bo'yicha
// ko'rishi/boshqarishi kerak, RLS esa aynan shuni bloklaydi (`tenants`/`users`
// jadvallari bilan bir xil sabab — `EnableRowLevelSecurity` migratsiyasidagi
// izohga qarang). Kirish nazorati ilova qatlamida: platforma admin tomoni
// `PlatformAdminGuard`, tenant tomoni esa oddiy `billing:view` ruxsati orqali.
//
// Hozircha HAQIQIY to'lov shlyuzi ulanmagan (foydalanuvchi tanlovi: "hozircha
// faqat tuzilma/mock") — to'lov platforma admin tomonidan qo'lda "to'landi deb
// belgilash" orqali tasdiqlanadi. Kelajakda haqiqiy shlyuz (Payme/Click/Stripe)
// ulanganda faqat shu qo'lda-belgilash bosqichi webhook bilan almashtiriladi.
@Entity('subscription_invoices')
@Index(['tenantId'])
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // Hisob-faktura yaratilgan paytdagi reja — keyinchalik tenant rejasini
  // o'zgartirsa ham, eski hisob-fakturalar tarixiy narxni saqlab qoladi.
  @Column({ type: 'enum', enum: TenantPlan })
  plan: TenantPlan;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'enum', enum: SubscriptionInvoiceStatus, default: SubscriptionInvoiceStatus.PENDING })
  status: SubscriptionInvoiceStatus;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'issued_at', type: 'timestamp' })
  issuedAt: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  // Real to'lov shlyuzi hali yo'q — shu userId "men to'landi deb tasdiqladim"
  // degan ma'noni bildiradi (har doim platforma admin).
  @Column({ name: 'marked_paid_by_user_id', type: 'uuid', nullable: true })
  markedPaidByUserId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
