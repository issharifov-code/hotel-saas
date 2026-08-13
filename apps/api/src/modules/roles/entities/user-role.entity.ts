import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';
import { Property } from '../../properties/entities/property.entity';

// Foydalanuvchi-Rol bog'lanishi. propertyId to'ldirilsa, rol faqat shu mulk (filial)
// doirasida amal qiladi — ko'p mulkli tenant'lar uchun (masalan "Filial A Front Desk xodimi").
// propertyId = null bo'lsa, rol tenant darajasida (barcha mulklarga) amal qiladi.
@Entity('user_roles')
@Index(['userId'])
@Index(['tenantId'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'property_id', type: 'uuid', nullable: true })
  propertyId: string | null;

  @ManyToOne(() => Property, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'property_id' })
  property: Property | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
