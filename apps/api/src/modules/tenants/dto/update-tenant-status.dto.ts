import { IsEnum } from 'class-validator';
import { TenantStatus } from '../entities/tenant.entity';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Ilgari bu yo'l xom
// `@Body('status') status: TenantStatus` ni qabul qilardi. Global
// `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) FAQAT klass-DTO
// bilan ishlaydi, ya'ni bu yerga istalgan qiymat kelib, to'g'ridan-to'g'ri
// entity'ga yozilardi — natijada Postgres enum xatosi (500) qaytardi.
export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status: TenantStatus;
}
