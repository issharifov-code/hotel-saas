import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Guest } from '../../guests/entities/guest.entity';

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

  // 🔴 KIM ekani PROFILDA (2026-09-04, foydalanuvchi qarori "Profil = shaxs,
  // Agency = pul"). Agentlikning nomi, telefoni, emaili va aloqa shaxsi shu
  // profildan o'qiladi — bu jadval faqat MULKKA XOS pul sozlamasini
  // (komissiya foizi) va faollik holatini saqlaydi.
  //
  // Profil TENANT darajasida, agentlik esa MULK darajasida: shu sababdan
  // bitta agentlikning har mulkda o'z komissiyasi bo'lishi mumkin.
  //
  // RESTRICT — profil o'chirilsa agentlik nomsiz qolib ketmasin. Amalda
  // profil faqat birlashtirish paytida o'chadi, u yerda havolalar oldindan
  // ko'chiriladi (GuestsService.mergeGuests).
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => Guest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'profile_id' })
  profile: Guest;

  // ESKI ustunlar (2026-09-04 dan boshlab O'QILMAYDI, faqat tarixiy yozuv
  // sifatida qoladi — migratsiyada ular profilga ko'chirilgan). Yangi kod
  // `profile.fullName` / `profile.phone` va hokazoni ishlatadi.
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
