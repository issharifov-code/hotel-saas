import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Channel } from './channel.entity';

// Bitta kanal (Channel) ichida bitta xona turi (RoomType) qanday narx
// rejasi (RatePlan, ixtiyoriy) bilan va qaysi tashqi (OTA'dagi) xona turi
// identifikatori bilan bog'langanini belgilaydi. `ratePlanId` berilmasa,
// sinxronlashda RoomType.basePrice ishlatiladi (RatePlan tanlanmasa
// bron yaratishdagi bazaviy-narx xulq-atvoriga o'xshab).
@Entity('channel_room_type_mappings')
@Index(['channelId', 'roomTypeId'], { unique: true })
export class ChannelRoomTypeMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel, (channel) => channel.mappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @Column({ name: 'rate_plan_id', type: 'uuid', nullable: true })
  ratePlanId: string | null;

  // OTA tizimidagi xona turi identifikatori — mock, haqiqiy integratsiya
  // ulanganda kerak bo'ladi. Berilmasa, sinxronlashda roomTypeId ishlatiladi.
  @Column({
    name: 'external_room_type_id',
    length: 100,
    nullable: true,
    type: 'varchar',
  })
  externalRoomTypeId: string | null;

  // Nofaol xaritalash sinxronlashda chetlab o'tiladi (kanaldan vaqtincha
  // uzish, xaritalashni o'chirmasdan).
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
