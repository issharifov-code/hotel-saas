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

// Profil turi (2026-09-04, OPERA Cloud "Manage Profile" referensi).
//
// OPERA'da bularning hammasi BITTA profil jadvalida yashaydi va bir-biriga
// bog'lanadi (mehmon -> kompaniya, bron -> turagent). Biz ham shu yo'ldan
// bordik: alohida jadval ochsak, bron/hisob-faktura/POS'dagi `guest_id`
// havolalari qaysi jadvalga qarashini bilmay qolardi.
//
// Muhim farq: `GUEST` — JISMONIY SHAXS (hujjat, tug'ilgan sana, sodiqlik
// ballari bor). COMPANY/TRAVEL_AGENT/SOURCE — TASHKILOT (STIR, manzil, aloqa
// shaxsi bor; sodiqlik yo'q). GROUP — bir nechta bron uchun umumiy nom.
// CONTACT — tashkilotdagi aniq odam (`parentProfileId` orqali bog'lanadi).
export enum ProfileType {
  GUEST = 'guest',
  COMPANY = 'company',
  TRAVEL_AGENT = 'travel_agent',
  SOURCE = 'source',
  GROUP = 'group',
  CONTACT = 'contact',
}

// Faqat shu turlar tashkilot hisoblanadi — validatsiya va UI shu ro'yxatga
// qarab qaror qiladi (bir joyda turgani uchun kelajakda tur qo'shilsa
// unutilib qolmaydi).
export const ORGANIZATION_PROFILE_TYPES: ProfileType[] = [
  ProfileType.COMPANY,
  ProfileType.TRAVEL_AGENT,
  ProfileType.SOURCE,
];

// Mehmon bilan qanday kanal orqali bog'lanish afzalligi (masalan bron
// tasdiqlash/eslatmalar) — hozircha faqat saqlanadi, avtomatik xabar
// yuborish integratsiyasi kelajakda shu maydonga qarab yo'naltiriladi.
export enum CommunicationPreference {
  EMAIL = 'email',
  SMS = 'sms',
  PHONE = 'phone',
  NONE = 'none',
}

// Mehmon tenant darajasida saqlanadi (property'ga bog'lanmagan) — ko'p mulkli
// zanjirda bitta mehmon turli filiallarda qolishi mumkin. Hujjat raqami O'zbekiston
// mehmonlarni ro'yxatga olish talablari uchun saqlanadi (front_desk moduli
// keyinchalik davlat tizimiga hisobot berishda shundan foydalanadi).
@Entity('guests')
@Index(['tenantId'])
@Index(['tenantId', 'profileType'])
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  // Standarti `guest` — bu ustun qo'shilgunga qadar mavjud bo'lgan hamma
  // qator jismoniy mehmon edi, shuning uchun migratsiya ham shu qiymatni
  // beradi.
  @Column({
    name: 'profile_type',
    type: 'enum',
    enum: ProfileType,
    default: ProfileType.GUEST,
  })
  profileType: ProfileType;

  // Jismoniy shaxsda — to'liq ism; tashkilotda — tashkilot nomi. Bitta ustun
  // qoldirildi (alohida `company_name` emas): bron, hisob-faktura va POS
  // hammasi shu maydonni ko'rsatadi, ikkiga bo'lsak har bir joyda "qaysi
  // biri?" degan shart paydo bo'lardi.
  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 50, nullable: true, type: 'varchar' })
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

  // Strukturaviy afzalliklar — CRM/duplicate-merge kengaytmasi (2026-08-17). `notes`dan
  // farqli, bular alohida maydonlar sifatida saqlanadi, chunki front-desk/booking
  // moduli kelajakda avtomatik ravishda (masalan bron yaratishda) shundan foydalanishi
  // mumkin (erkin matnni tahlil qilishga hojat qoldirmasdan).
  @Column({
    name: 'room_preference',
    length: 255,
    nullable: true,
    type: 'varchar',
  })
  roomPreference: string | null; // masalan "Yuqori qavat, tinch xona"

  @Column({
    name: 'dietary_preference',
    length: 255,
    nullable: true,
    type: 'varchar',
  })
  dietaryPreference: string | null; // masalan "Vegetarian, yong'oqqa allergiya"

  @Column({
    name: 'communication_preference',
    type: 'enum',
    enum: CommunicationPreference,
    default: CommunicationPreference.EMAIL,
  })
  communicationPreference: CommunicationPreference;

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

  // --- Tashkilot profillari uchun (COMPANY / TRAVEL_AGENT / SOURCE) -------
  // Jismoniy mehmonda bular bo'sh qoladi va aksincha (validatsiya buni
  // ta'minlaydi) — shu sababdan hammasi nullable.

  @Column({ name: 'tax_id', length: 50, nullable: true, type: 'varchar' })
  taxId: string | null; // O'zbekistonda — STIR

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  address: string | null;

  @Column({ length: 100, nullable: true, type: 'varchar' })
  city: string | null;

  // Tashkilotda kim bilan gaplashiladi (bir qatorlik ism) — to'liq alohida
  // profil kerak bo'lsa CONTACT turi ochiladi va `parentProfileId` bilan
  // shu tashkilotga bog'lanadi.
  @Column({
    name: 'contact_person',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  contactPerson: string | null;

  // ESLATMA: komissiya foizi bu yerda YO'Q (2026-09-04). U mulkka bog'liq
  // pul sozlamasi va `agencies.commission_pct`da yashaydi — profil esa
  // faqat "kim ekani"ni saqlaydi. Ikkalasida ham bo'lsa, qaysi biri haqiqiy
  // ekani noaniq bo'lib qolardi.

  // CONTACT profilining tashkiloti (COMPANY/TRAVEL_AGENT/SOURCE). O'z-o'ziga
  // havola — tashkilot o'chirilsa kontakt qolib ketadi, faqat bog'lanish
  // uziladi (SET NULL), chunki kontakt odamning o'zi hali ham mavjud.
  @Column({ name: 'parent_profile_id', type: 'uuid', nullable: true })
  parentProfileId: string | null;

  @ManyToOne(() => Guest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_profile_id' })
  parentProfile: Guest | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
