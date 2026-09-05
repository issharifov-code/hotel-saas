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

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M13). Takroriy murojaatlarni
  // aniqlash uchun normallashtirilgan shakl (faqat raqamlar, mamlakat
  // kodisiz). Ko'rsatishda hamon asl `phone` ishlatiladi — foydalanuvchi
  // qanday kiritgan bo'lsa, admin shundayligicha ko'radi.
  //
  // Indeks (`phone_normalized`, `created_at DESC`) migratsiyada
  // yaratiladi — bu yerda `@Index` qo'yilmaydi, aks holda entity bir
  // ustunli, migratsiya esa ikki ustunli indeksni e'lon qilib, ikkisi
  // bir-biriga zid ta'rif bo'lib qolardi.
  @Column({ name: 'phone_normalized', length: 50, default: '' })
  phoneNormalized: string;

  // `string | null` union tip bilan reflect-metadata dizayn-vaqtida `Object`
  // deb aniqlaydi (TypeORM'ning maʼlum cheklovi), shuning uchun `type: 'varchar'`
  // aniq ko'rsatilishi shart — aks holda `DataTypeNotSupportedError` bilan
  // ilova ishga tushmay qoladi.
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  @Column({ name: 'contacted', type: 'boolean', default: false })
  contacted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
