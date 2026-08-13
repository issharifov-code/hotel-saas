import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { PermissionModule, PermissionAction } from '../../../common/enums/permission.enum';

// Permission'lar tenant'ga bog'liq emas — butun platforma uchun bitta umumiy ro'yxat
// (masalan: booking.create, accounting.approve). Role'lar shulardan tanlab oladi.
@Entity('permissions')
@Unique(['module', 'action'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PermissionModule })
  module: PermissionModule;

  @Column({ type: 'enum', enum: PermissionAction })
  action: PermissionAction;

  // Foydalanuvchiga ko'rsatish uchun qisqa izoh, masalan "Bronni yaratish"
  @Column({ length: 200, nullable: true })
  description: string;
}
