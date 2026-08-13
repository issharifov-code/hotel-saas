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

  @Column({ length: 3, default: 'UZS' })
  baseCurrency: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ type: 'enum', enum: TenantPlan, default: TenantPlan.START })
  plan: TenantPlan;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
