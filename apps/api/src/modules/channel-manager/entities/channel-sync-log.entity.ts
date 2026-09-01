import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Channel } from './channel.entity';

export enum ChannelSyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

// Har bir sinxronlash (sync) urinishi uchun audit yozuvi — MessageLog
// (Messaging moduli) bilan bir xil "har bir tashqi chaqiruvni jurnalga
// yozish" naqshi. Xodim kanal sahifasida sinxronlash tarixini ko'rishi
// mumkin (muvaffaqiyatli/muvaffaqiyatsiz, nechta xona turi/kun yuborilgani).
@Entity('channel_sync_logs')
@Index(['channelId'])
export class ChannelSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'synced_at', type: 'timestamp' })
  syncedAt: Date;

  @Column({
    type: 'enum',
    enum: ChannelSyncStatus,
    enumName: 'channel_sync_logs_status_enum',
  })
  status: ChannelSyncStatus;

  @Column({ name: 'room_types_synced', type: 'int' })
  roomTypesSynced: number;

  @Column({ name: 'days_synced', type: 'int' })
  daysSynced: number;

  @Column({ length: 1000 })
  summary: string;

  @Column({
    name: 'provider_ref',
    length: 200,
    nullable: true,
    type: 'varchar',
  })
  providerRef: string | null;

  @Column({
    name: 'failure_reason',
    length: 500,
    nullable: true,
    type: 'varchar',
  })
  failureReason: string | null;
}
