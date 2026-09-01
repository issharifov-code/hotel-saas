import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// Login sahifasidagi "Demo so'rash" formasidan kelgan murojaatlar.
// Bu jadval hech qanday tenant'ga tegishli emas (hali hech qanday tenant
// mavjud bo'lmasligi ham mumkin — potensial mijoz hali ro'yxatdan o'tmagan),
// shuning uchun RLS/tenant-scoping qo'llanilmaydi (billing/users/tenants
// jadvallari bilan bir xil - platforma darajasidagi ma'lumot).
@Entity('demo_requests')
export class DemoRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 50 })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string | null;

  @Column({ length: 1000, nullable: true })
  note: string | null;

  @Column({ name: 'contacted', type: 'boolean', default: false })
  contacted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
