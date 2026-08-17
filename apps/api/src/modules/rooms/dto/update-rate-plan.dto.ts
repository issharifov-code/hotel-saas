import { IsBoolean, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

// Rate plan tahrirlash — hammasi ixtiyoriy (partial update): odatda faqat
// narxni yangilash yoki isActive'ni almashtirish (deaktivatsiya) uchun ishlatiladi.
export class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumberString({}, { message: "nightlyPrice raqam ko'rinishida bo'lishi kerak" })
  nightlyPrice?: string;

  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
