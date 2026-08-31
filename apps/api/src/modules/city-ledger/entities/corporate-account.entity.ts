import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

// City Ledger / Korporativ hisob (Corporate Account) — mehmonxona bilan
// to'g'ridan-to'g'ri "kredit"da ishlaydigan kompaniya: mehmonlar check-out
// paytida o'zi to'lamaydi, hisob-faktura shu kompaniyaga "qarz" sifatida
// yoziladi va keyin bitta oylik/davriy hisob-varaq (statement) bo'yicha
// to'lanadi. Agency'dan (Agentlik) farqi — Agency KOMISSIYA oladi (mehmon
// yo'naltirgani uchun, mehmonning o'zi to'laydi), CorporateAccount esa
// TO'LOVCHI tomon (mehmon o'rniga kompaniya to'laydi). Har bir shu hisob
// orqali kelgan bron (Booking.corporateAccountId) shu yerga bog'lanadi.
// Hech qanday avtomatik accounting provodkasi qilinmaydi — CityLedgerService
// mavjud Invoice/InvoicePayment yozuvlaridan real vaqtda hisob-varaq
// hisoblab beradi (AgenciesService.getSummary/ReportsService naqshiga
// o'xshab, faqat-o'qish agregatsiya).
@Entity('corporate_accounts')
@Index(['tenantId', 'propertyId'])
export class CorporateAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ length: 200 })
  name: string;

  // Soliq to'lovchi identifikatsiya raqami (STIR) — ixtiyoriy, hisob-varaq/
  // rasmiy hujjatlar uchun foydali bo'lishi mumkin.
  @Column({ name: 'tax_id', length: 50, nullable: true, type: 'varchar' })
  taxId: string | null;

  @Column({
    name: 'contact_name',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    length: 50,
    nullable: true,
    type: 'varchar',
  })
  contactPhone: string | null;

  @Column({
    name: 'contact_email',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  contactEmail: string | null;

  @Column({
    name: 'billing_address',
    length: 1000,
    nullable: true,
    type: 'varchar',
  })
  billingAddress: string | null;

  // Kredit limiti — ixtiyoriy, faqat ma'lumot/ogohlantirish maqsadida
  // saqlanadi (hozircha bron/hisob-faktura yaratishni AVTOMATIK bloklamaydi
  // — bu kelajakda alohida qaror sifatida qo'shilishi mumkin).
  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  creditLimit: string | null;

  // To'lov muddati (kun) — hisob-faktura chiqarilgan (issuedAt) kundan
  // boshlab necha kun ichida to'lanishi kerak. Statement'da shu muddatdan
  // o'tgan, hali to'lanmagan hisob-fakturalar "muddati o'tgan" deb belgilanadi.
  @Column({ name: 'payment_terms_days', type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  // Faol bo'lmagan hisoblar bron yaratishda tanlov ro'yxatida ko'rsatilmaydi,
  // lekin mavjud bronlar/hisob-fakturalar (allaqachon bog'langan) buzilmaydi.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Booking, (booking) => booking.corporateAccount)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
