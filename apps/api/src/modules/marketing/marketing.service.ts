import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { DemoRequest } from './entities/demo-request.entity';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';
import {
  PaginatedResult,
  parsePagination,
} from '../../common/utils/pagination.util';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M13). Takroriy murojaat
// oynasi: shu vaqt ichida bir xil telefon raqamdan kelgan yangi so'rov
// yangi qator ochmaydi.
//
// Nima uchun kerak: `@Throttle` IP bo'yicha ishlaydi, ya'ni forma
// "Yuborish" tugmasi ikki marta bosilganda ham, mobil tarmoq NAT'i
// ortidagi turli mijozlar bir chegarani baham ko'rganda ham nozik.
// Dedup esa mazmun bo'yicha ishlaydi va IP'ga umuman bog'liq emas.
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(DemoRequest)
    private readonly demoRequestRepo: Repository<DemoRequest>,
  ) {}

  async createDemoRequest(dto: CreateDemoRequestDto): Promise<DemoRequest> {
    const phone = normalizePhone(dto.phone);

    // Idempotent va "jim": takror murojaat XATO emas — foydalanuvchi
    // "so'rovingiz qabul qilindi" javobini ko'raverishi kerak, aks holda
    // xato xabari uni qayta-qayta yuborishga undaydi (va bu vaqtda uning
    // murojaati allaqachon ro'yxatda turgan bo'ladi). Mavjud qator
    // qaytariladi.
    const recent = await this.demoRequestRepo.findOne({
      where: {
        phoneNormalized: phone,
        createdAt: MoreThan(new Date(Date.now() - DEDUP_WINDOW_MS)),
      },
      order: { createdAt: 'DESC' },
    });
    if (recent) return recent;

    const request = this.demoRequestRepo.create({
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      phoneNormalized: phone,
      email: dto.email?.trim().toLowerCase() ?? null,
      note: dto.note?.trim() ?? null,
    });
    return this.demoRequestRepo.save(request);
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium — M13). Ilgari bu metod
  // BUTUN jadvalni bir so'rovda qaytarardi (`find()` — limitsiz).
  // Demo so'rovlari ochiq yo'ldan keladi, ya'ni jadval hajmini tashqi
  // tomon belgilaydi: yetarlicha qator to'plangach, admin ro'yxatini
  // ochish serverni ham, brauzerni ham cho'ktirardi.
  async listDemoRequests(
    page?: string,
    pageSize?: string,
  ): Promise<PaginatedResult<DemoRequest>> {
    const { skip, take, ...meta } = parsePagination(page, pageSize, 50, 200);
    const [items, total] = await this.demoRequestRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { items, total, ...meta };
  }

  async markContacted(id: string, contacted: boolean): Promise<DemoRequest> {
    await this.demoRequestRepo.update({ id }, { contacted });
    const updated = await this.demoRequestRepo.findOneBy({ id });
    return updated!;
  }
}

/**
 * Telefon raqamini taqqoslash uchun normallashtiradi: raqamlardan
 * boshqasi (bo'shliq, tire, qavs, `+`) olib tashlanadi. `+998 90 123
 * 45 67`, `998901234567` va `(90) 123-45-67` uchun turlicha bo'lishi
 * mumkin, shuning uchun O'zbekiston kodi ham normallashtiriladi:
 * 12 xonali `998...` va 9 xonali mahalliy raqam bir xil kalitga tushadi.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('998')) return digits.slice(3);
  if (digits.length === 13 && digits.startsWith('0998')) return digits.slice(4);
  return digits;
}
