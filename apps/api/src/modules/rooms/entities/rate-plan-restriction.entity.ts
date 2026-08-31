import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RatePlan } from './rate-plan.entity';

// Narx rejasi cheklovi (Rate Restriction) — bitta narx rejasi ostida, aniq bir
// sana uchun sotuv qoidalarini belgilaydi: kelish/jo'nab ketish yopiq
// (Closed to Arrival/Departure), eng kam/eng ko'p turish kechalari (Min/Max
// Length of Stay), yoki butunlay sotuvdan yopish (Stop Sell). Har bir
// (rate_plan_id, date) juftligi uchun bitta yozuv — cheklov qo'yilmagan
// sanalar uchun umuman yozuv yo'q (standart holat — hech qanday cheklov yo'q).
@Entity('rate_plan_restrictions')
@Index(['ratePlanId', 'date'], { unique: true })
export class RatePlanRestriction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rate_plan_id', type: 'uuid' })
  ratePlanId: string;

  @ManyToOne(() => RatePlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rate_plan_id' })
  ratePlan: RatePlan;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'closed_to_arrival', type: 'boolean', default: false })
  closedToArrival: boolean;

  @Column({ name: 'closed_to_departure', type: 'boolean', default: false })
  closedToDeparture: boolean;

  @Column({ name: 'min_length_of_stay', type: 'int', nullable: true })
  minLengthOfStay: number | null;

  @Column({ name: 'max_length_of_stay', type: 'int', nullable: true })
  maxLengthOfStay: number | null;

  // Shu sana uchun narx rejasi butunlay sotuvdan yopiladi (yangi bron qabul
  // qilinmaydi, kelish holatidan qat'i nazar).
  @Column({ name: 'stop_sell', type: 'boolean', default: false })
  stopSell: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
