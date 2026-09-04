import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Mulkning oylik moliyaviy REJASI (budjet). Har bir qator — bitta mulkning
// bitta oyi uchun maqsad ko'rsatkichlari.
//
// NIMA UCHUN AYNAN SHU UCH KO'RSATKICH: ular `ReportsService.getOverview`
// hisoblaydigan haqiqiy ko'rsatkichlar bilan bir xil (bandlik %, ADR,
// daromad) — shunda Dashboard'da "reja vs haqiqat" taqqoslashi hech qanday
// qo'shimcha hisob-kitobsiz to'g'ridan-to'g'ri chiqadi. RevPAR ataylab yo'q:
// u ADR × bandlik'dan kelib chiqadi, alohida reja kiritish faqat qarama-qarshi
// qiymatlarga olib kelardi.
//
// Uchala ustun ham `nullable` — mehmonxona faqat o'ziga kerakli ko'rsatkichni
// rejalashtirishi mumkin (masalan faqat daromadni). Bo'sh qolgan ko'rsatkich
// Dashboard'da shunchaki ko'rsatilmaydi.
@Entity('budgets')
@Index(['tenantId', 'propertyId'])
@Unique(['propertyId', 'year', 'month'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ type: 'int' })
  year: number;

  // 1-12. DB darajasida ham CHECK bilan cheklangan (qarang AddBudgets
  // migratsiyasi) — DTO tekshiruvidan o'tib ketgan noto'g'ri qiymat
  // bazaga tushmasligi uchun.
  @Column({ type: 'int' })
  month: number;

  // Pul miqdorlari numeric sifatida (float xatoliklarining oldini olish
  // uchun) — ilovadagi boshqa pul ustunlari bilan bir xil naqsh.
  @Column({
    name: 'rooms_revenue',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  roomsRevenue: string | null;

  @Column({
    name: 'occupancy_rate_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  occupancyRatePct: string | null;

  @Column({
    name: 'adr',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  adr: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
