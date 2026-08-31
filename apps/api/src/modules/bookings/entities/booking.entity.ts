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
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Guest } from '../../guests/entities/guest.entity';
import { RatePlan } from '../../rooms/entities/rate-plan.entity';
import { BookingGroup } from './booking-group.entity';
import { Agency } from '../../agencies/entities/agency.entity';
import { CorporateAccount } from '../../city-ledger/entities/corporate-account.entity';

export enum BookingStatus {
  PENDING = 'pending', // hali tasdiqlanmagan (masalan to'lov kutilmoqda)
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum BookingSource {
  DIRECT = 'direct', // resepshn/telefon orqali to'g'ridan-to'g'ri bron
  WEBSITE = 'website',
  OTA = 'ota', // Booking.com va h.k.
  EXELY = 'exely', // migratsiya/parallel integratsiya davri uchun
}

// Bozor segmenti — hisobot/tahlil uchun (qaysi mijoz toifasi qancha daromad
// keltirayotgani). `source` (qanday kanal orqali kelgani) bilan mustaqil —
// masalan bitta OTA bronida ham market segment "corporate" bo'lishi mumkin.
export enum MarketSegment {
  WALK_IN = 'walk_in',
  CORPORATE = 'corporate',
  OTA = 'ota',
  TRAVEL_AGENT = 'travel_agent',
  GROUP = 'group',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

@Entity('bookings')
@Index(['tenantId', 'propertyId'])
@Index(['roomId', 'checkIn', 'checkOut']) // band vaqt oralig'ini tekshirish tez ishlashi uchun
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({ type: 'enum', enum: BookingSource, default: BookingSource.DIRECT })
  source: BookingSource;

  @Column({
    name: 'market_segment',
    type: 'enum',
    enum: MarketSegment,
    default: MarketSegment.OTHER,
  })
  marketSegment: MarketSegment;

  // Tanlangan narx rejasi (ixtiyoriy) — berilgan bo'lsa, totalAmount shu
  // rejaning nightlyPrice'idan hisoblanadi (RoomType.basePrice o'rniga).
  // Xona turi almashtirilib, yangi xona shu rejaga tegishli bo'lmasa, backend
  // buni avtomatik null qiladi (bookings.service.ts'dagi changeRoom'ga qarang).
  @Column({ name: 'rate_plan_id', type: 'uuid', nullable: true })
  ratePlanId: string | null;

  @ManyToOne(() => RatePlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rate_plan_id' })
  ratePlan: RatePlan | null;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ length: 3 })
  currency: string;

  // Exely (yoki boshqa tashqi PMS) bron ID'si — migratsiya/dedupe uchun.
  @Column({
    name: 'external_ref',
    length: 100,
    nullable: true,
    type: 'varchar',
  })
  externalRef: string | null;

  @Column({ length: 1000, nullable: true, type: 'varchar' })
  notes: string | null;

  // Guruh/blok bron (ixtiyoriy) — berilsa, bu bron bitta BookingGroup'ning
  // "rooming list"idagi bitta qatori hisoblanadi. Guruh o'chirilsa (hozircha
  // o'chirish funksiyasi yo'q) bron o'zi saqlanib qoladi (SET NULL) —
  // check-in/check-out/folio mantig'iga hech qanday ta'sir qilmaydi.
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => BookingGroup, (group) => group.bookings, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'group_id' })
  group: BookingGroup | null;

  // Turizm agentligi (ixtiyoriy) — berilsa, bu bron shu agentlik orqali
  // kelgan hisoblanadi (komissiya hisob-kitobi uchun). Agentlik o'chirilsa
  // (hozircha o'chirish funksiyasi yo'q) bron o'zi saqlanib qoladi (SET NULL) —
  // check-in/check-out/folio mantig'iga hech qanday ta'sir qilmaydi.
  @Column({ name: 'agency_id', type: 'uuid', nullable: true })
  agencyId: string | null;

  @ManyToOne(() => Agency, (agency) => agency.bookings, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency | null;

  // Korporativ hisob (City Ledger, ixtiyoriy) — berilsa, bu bron shu
  // kompaniya "kredit"ida hisoblanadi: mehmon check-out paytida o'zi
  // to'lamaydi, hisob-faktura kompaniyaning hisob-varag'iga (statement)
  // qo'shiladi (CityLedgerService.getStatement, real vaqtda hisoblanadi).
  // Hisob o'chirilsa (hozircha o'chirish funksiyasi yo'q) bron o'zi saqlanib
  // qoladi (SET NULL) — check-in/check-out/folio mantig'iga hech qanday
  // ta'sir qilmaydi.
  @Column({ name: 'corporate_account_id', type: 'uuid', nullable: true })
  corporateAccountId: string | null;

  @ManyToOne(() => CorporateAccount, (account) => account.bookings, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'corporate_account_id' })
  corporateAccount: CorporateAccount | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
