import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Agency } from './agency.entity';
import { AgencyCommission } from './agency-commission.entity';

// Agentlikka qilingan bitta to'lov — bir nechta komissiya qatorini birdan
// yopadi (odatda oy oxirida "shu oyda kelgan hamma bronlar uchun" bitta
// pul o'tkazmasi qilinadi).
//
// Qisman to'lov summani bo'lish orqali emas, QATORLARNI TANLASH orqali
// bo'ladi: to'lov qaysi bronlarni qopplaganini bilish agentlik bilan
// hisob-kitobda eng ko'p kerak bo'ladigan narsa, va summani ixtiyoriy
// bo'lish uni yo'qotardi.
export enum AgencyPaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
}

// Qaysi tizim hisobiga kredit yoziladi (pul qayerdan chiqdi).
export const AGENCY_PAYMENT_SYSTEM_KEY: Record<AgencyPaymentMethod, string> = {
  [AgencyPaymentMethod.CASH]: 'cash',
  [AgencyPaymentMethod.CARD]: 'card_clearing',
  [AgencyPaymentMethod.BANK_TRANSFER]: 'bank_transfer',
};

@Entity('agency_commission_payments')
@Index(['tenantId', 'propertyId', 'agencyId', 'paidOn'])
export class AgencyCommissionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne(() => Agency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20 })
  method: AgencyPaymentMethod;

  // To'lov SANASI — provodka aynan shu sanaga yoziladi. Buxgalter o'tgan
  // kunni ko'rsatishi mumkin (bank ko'chirmasi kechikib kelgan holat).
  @Column({ name: 'paid_on', type: 'date' })
  paidOn: string;

  // To'lov topshirig'i raqami / bank ma'lumotnomasi.
  @Column({ type: 'varchar', length: 200, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AgencyCommission, (c) => c.payment)
  commissions: AgencyCommission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
