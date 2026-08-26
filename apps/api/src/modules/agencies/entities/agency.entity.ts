import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

// Turizm agentligi / korporativ hamkor (Travel Agent / Corporate Account) —
// mehmonxonaga muntazam mehmon yo'naltiradigan tashqi tashkilot. Har bir shu
// agentlik orqali kelgan bron (Booking.agencyId) shu yerga bog'lanadi.
// Komissiya moliyaviy provodka sifatida YOZILMAYDI (accounting zanjiriga
// ataylab tegilmagan, Night Audit/Group Booking'dagi additiv dizayn
// tamoyiliga muvofiq) — buning o'rniga AgenciesService.getSummary() mavjud
// Booking.totalAmount'lardan real vaqtda hisoblab beradi (ReportsService
// naqshiga o'xshab, faqat-o'qish agregatsiya).
@Entity('agencies')
@Index(['tenantId', 'propertyId'])
export class Agency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'contact_name', length: 200, nullable: true, type: 'varchar' })
  contactName: string | null;

  @Column({ name: 'contact_phone', length: 50, nullable: true, type: 'varchar' })
  contactPhone: string | null;

  @Column({ name: 'contact_email', length: 200, nullable: true, type: 'varchar' })
  contactEmail: string | null;

  // Komissiya foizi — har bir shu agentlik orqali kelgan bronning
  // totalAmount'idan qancha foiz agentlikka to'lanishi hisoblanadi
  // (faqat hisobot uchun, avtomatik to'lov/provodka qilinmaydi).
  @Column({
    name: 'commission_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 10,
  })
  commissionPct: string;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  // Faol bo'lmagan agentliklar bron yaratishda tanlov ro'yxatida
  // ko'rsatilmaydi, lekin mavjud bronlar (allaqachon bog'langan) buzilmaydi.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Booking, (booking) => booking.agency)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
