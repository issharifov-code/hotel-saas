import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ChannelRoomTypeMapping } from './channel-room-type-mapping.entity';

// Qaysi OTA (Online Travel Agency)/distribution kanaliga ulanganini
// belgilaydi — hozircha faqat ma'lumot/tashkiliy maqsadda (haqiqiy API
// integratsiyasi yo'q, MockChannelAdapter orqali simulyatsiya qilinadi).
export enum ChannelProvider {
  BOOKING_COM = 'booking_com',
  AIRBNB = 'airbnb',
  AGODA = 'agoda',
  EXPEDIA = 'expedia',
  OTHER = 'other',
}

// Channel Manager — mehmonxonaning bir nechta OTA (Booking.com, Airbnb va
// h.k.) kanaliga ulangan "kanal"i. Har bir kanal xona turlarini (RoomType)
// o'ziga xos narx rejasi bilan bog'lab (ChannelRoomTypeMapping), mavjudlik
// va narxni markazlashtirilgan holda kanalga "yuboradi" (sync) — bu orqali
// mehmonxona bir nechta OTA'da bir vaqtda haddan tashqari bron (overbooking)
// qilishning oldini oladi. Haqiqiy OTA API'lari hali ulanmagan — shuning
// uchun Payments/Messaging modullaridagi adapter naqshi qayta ishlatilgan:
// ChannelAdapter interfeysi + hozircha yagona MockChannelAdapter.
@Entity('channels')
@Index(['tenantId', 'propertyId'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  // Xodim tomonidan berilgan nom (masalan "Booking.com — Asosiy",
  // "Airbnb — Toshkent filiali") — provider bilan bir xil bo'lmasligi mumkin
  // (bitta provider uchun bir nechta kanal bo'lishi mumkin).
  @Column({ length: 200 })
  name: string;

  @Column({
    type: 'enum',
    enum: ChannelProvider,
    enumName: 'channels_provider_enum',
  })
  provider: ChannelProvider;

  // OTA tizimidagi mulk (property) identifikatori — mock, haqiqiy qiymat
  // haqiqiy integratsiya ulanganda kerak bo'ladi.
  @Column({
    name: 'external_property_id',
    length: 100,
    nullable: true,
    type: 'varchar',
  })
  externalPropertyId: string | null;

  // Nofaol kanal sinxronlash (sync) uchun tanlanmaydi, lekin mavjud
  // xaritalash (mapping)/jurnal yozuvlari saqlanib qoladi.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @OneToMany(() => ChannelRoomTypeMapping, (mapping) => mapping.channel)
  mappings: ChannelRoomTypeMapping[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
