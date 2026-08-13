import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Permission } from './permission.entity';

// Role — Role Management modulining markazi. Har bir tenant o'z rollarini yaratadi;
// tizim (standart) rollari `isSystem=true` bilan avtomatik nusxalanadi va o'chirib bo'lmaydi,
// lekin ruxsatlari moslashtirilishi mumkin.
@Entity('roles')
@Index(['tenantId'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Platforma darajasidagi rollar (masalan super-admin) uchun null bo'lishi mumkin.
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ length: 100 })
  name: string;

  // Standart rolni frontendda/migratsiyada aniqlash uchun kalit, masalan "owner", "accountant".
  @Column({ name: 'system_key', type: 'varchar', length: 50, nullable: true })
  systemKey: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @ManyToMany(() => Permission, { eager: false })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
