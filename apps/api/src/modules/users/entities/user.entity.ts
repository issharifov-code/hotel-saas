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

// Payroll moduli (2026-09): xodimga qanday to'lanishi. MONTHLY — bir oylik
// bazaviy maosh (`salaryAmount` = oylik summa). HOURLY — soatlik stavka
// (`salaryAmount` = bir soatlik narx, ish soatlari har bir payroll ishga
// tushirilganda qo'lda kiritiladi — tizimda hali davomat/attendance moduli
// yo'q).
export enum SalaryType {
  MONTHLY = 'monthly',
  HOURLY = 'hourly',
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

  // Payroll (2026-09): ikkalasi ham ixtiyoriy — belgilanmagan xodim payroll
  // ishga tushirilganda avtomatik ro'yxatga kiritilmaydi (StaffPage'da
  // "Maosh belgilash" orqali o'rnatiladi). `salaryAmount` MONTHLY uchun
  // oylik summa, HOURLY uchun bir soatlik stavka sifatida talqin qilinadi.
  @Column({
    name: 'salary_type',
    type: 'enum',
    enum: SalaryType,
    nullable: true,
  })
  salaryType: SalaryType | null;

  @Column({
    name: 'salary_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  salaryAmount: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  // Platforma super-admin flag'i — tenant rollaridan mustaqil.
  @Column({ name: 'is_platform_admin', default: false })
  isPlatformAdmin: boolean;

  // 🔴 Token bekor qilish hisoblagichi (2026-09-05, kod auditi). Berilgan
  // token ichiga `tv` sifatida yoziladi va har so'rovda shu qiymat bilan
  // solishtiriladi (JwtStrategy). Statusni o'zgartirish yoki parolni
  // almashtirish uni oshiradi — natijada o'sha foydalanuvchining barcha
  // eski tokenlari bir zumda kuchini yo'qotadi.
  //
  // Buni oshiradigan joylar SANOQLI va hammasi `UsersService` ichida:
  // `updateStatus`, `resetPassword`. Yangi "sessiyani tugatuvchi" amal
  // qo'shilsa (masalan email orqali parol tiklash), u ham shu yerdan
  // o'tishi kerak.
  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
