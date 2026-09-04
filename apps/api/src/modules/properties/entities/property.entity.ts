import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

// Bitta tenant (mehmonxona kompaniyasi) bir nechta mulkka (property/filial) ega bo'lishi mumkin.
// Enterprise tarif rejasi ko'p mulkli zanjirlarni shu orqali qo'llab-quvvatlaydi.
@Entity('properties')
@Index(['tenantId'])
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ length: 3 })
  currency: string;

  // Mehmonxonaning o'z logotipi — `data:image/...;base64,...` matni sifatida
  // saqlanadi (qarang AddPropertyLogo migratsiyasi: Render API'sida doimiy
  // disk yo'q, shuning uchun rasm bazada). Rasm brauzerda 256px'gacha
  // kichraytirilib yuboriladi, backend hajmi va turini qayta tekshiradi.
  // `null` bo'lsa — frontend nomining bosh harfi bilan piktogramma chizadi.
  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  // Mulkning joriy "biznes sanasi" — Night Audit ("kunni yopish") orqali
  // har safar bir kunga suriladi (NightAuditService.run). Yangi property
  // uchun DB DEFAULT CURRENT_DATE orqali bugungi sana bilan boshlanadi.
  @Column({ name: 'business_date', type: 'date' })
  businessDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
