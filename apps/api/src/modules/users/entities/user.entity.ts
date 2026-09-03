import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INVITED = 'invited', // taklif yuborilgan, hali parol o'rnatmagan
  DISABLED = 'disabled',
}

// Bitta foydalanuvchi = aniq bitta tenant'ga tegishli (agentlik stsenariysi keyingi bosqichda).
// Platforma super-admin foydalanuvchilari uchun tenantId=null.
@Entity('users')
@Index(['tenantId'])
@Unique(['tenantId', 'email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  // Ixtiyoriy lavozim/rol matni (masalan "Egasi", "Bosh menejer") — hozircha
  // faqat ro'yxatdan o'tish formasida so'raladi. `type: 'varchar'` aniq
  // ko'rsatilgan — sababi `roomsCountHint`dagi izohda tushuntirilgan.
  @Column({ type: 'varchar', length: 150, nullable: true })
  position: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  // Platforma super-admin flag'i — tenant rollaridan mustaqil.
  @Column({ name: 'is_platform_admin', default: false })
  isPlatformAdmin: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
