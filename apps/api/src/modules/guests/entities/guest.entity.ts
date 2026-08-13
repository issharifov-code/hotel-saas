import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

// Mehmon tenant darajasida saqlanadi (property'ga bog'lanmagan) — ko'p mulkli
// zanjirda bitta mehmon turli filiallarda qolishi mumkin. Hujjat raqami O'zbekiston
// mehmonlarni ro'yxatga olish talablari uchun saqlanadi (front_desk moduli
// keyinchalik davlat tizimiga hisobot berishda shundan foydalanadi).
@Entity('guests')
@Index(['tenantId'])
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 30, nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  email: string | null;

  @Column({ length: 100, nullable: true, type: 'varchar' })
  nationality: string | null;

  @Column({ name: 'document_type', length: 30, nullable: true, type: 'varchar' })
  documentType: string | null; // masalan "passport", "id_card"

  @Column({ name: 'document_number', length: 50, nullable: true, type: 'varchar' })
  documentNumber: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
