import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TenantStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export enum TenantPlan {
  START = 'start',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

// Har bir mehmonxona (mijoz) = bitta Tenant. Multi-tenancy strategiyasi:
// shared schema + tenant_id (bu ustun barcha tenant-scoped jadvallarda takrorlanadi).
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  // Subdomain marshrutlash uchun: {subdomain}.sizningsaas.uz
  @Column({ unique: true, length: 63 })
  subdomain: string;

  // DIQQAT: DB ustuni tarixan literal, mixed-case `"baseCurrency"` nomi bilan
  // yaratilgan (boshlang'ich migratsiya shu unmapped entity'dan generatsiya
  // qilingan) — loyihaning boshqa hamma joyida snake_case qoidasiga amal
  // qilinadi. `name:` shu holatni ENDI ANIQ ko'rsatadi (avval yashirin/default
  // edi) — bu Booking.marketSegment'da yuz bergan sinfdagi xatoning oldini
  // oladi: agar kelajakda kimdir shu ustunni "to'g'irlash" uchun snake_case'ga
  // o'tkazadigan migratsiya yozsa, shu qatorni ham yangilashi SHART bo'ladi.
  @Column({ name: 'baseCurrency', length: 3, default: 'UZS' })
  baseCurrency: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ type: 'enum', enum: TenantPlan, default: TenantPlan.START })
  plan: TenantPlan;

  // Ro'yxatdan o'tishda SampleDataService tomonidan avtomatik to'ldirilgan namunaviy
  // (demo) ma'lumotlar hali mavjudmi. Front-end shu bayroq true bo'lsa "Namunaviy
  // ma'lumotlarni o'chirish" bannerini ko'rsatadi (SampleDataController.remove orqali).
  @Column({ name: 'has_sample_data', type: 'boolean', default: false })
  hasSampleData: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
