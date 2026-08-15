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

// Loyalty darajalari — `lifetimePoints` (hech qachon kamaymaydigan, umr bo'yi
// to'plangan ball) asosida avtomatik hisoblanadi (qarang: LoyaltyService.calculateTier).
// `loyaltyPoints` esa amaldagi (sarflash mumkin bo'lgan) qoldiq — redeem/adjust bilan kamayishi mumkin.
export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

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

  @Column({
    name: 'document_type',
    length: 30,
    nullable: true,
    type: 'varchar',
  })
  documentType: string | null; // masalan "passport", "id_card"

  @Column({
    name: 'document_number',
    length: 50,
    nullable: true,
    type: 'varchar',
  })
  documentNumber: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  // Front Desk/CRM xodimlari uchun erkin izoh (masalan: xona afzalliklari, allergiya, VIP eslatmalar).
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Loyalty — CRM/Loyalty moduli (LoyaltyService orqali boshqariladi, to'g'ridan-to'g'ri yozilmaydi).
  @Column({
    name: 'loyalty_tier',
    type: 'enum',
    enum: LoyaltyTier,
    default: LoyaltyTier.BRONZE,
  })
  loyaltyTier: LoyaltyTier;

  // Amaldagi sarflash mumkin bo'lgan ball qoldig'i (redeem/adjust bilan kamayadi).
  @Column({ name: 'loyalty_points', type: 'int', default: 0 })
  loyaltyPoints: number;

  // Umr bo'yi to'plangan jami ball (hech qachon kamaymaydi) — loyalty darajasi shundan hisoblanadi.
  @Column({ name: 'lifetime_points', type: 'int', default: 0 })
  lifetimePoints: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
