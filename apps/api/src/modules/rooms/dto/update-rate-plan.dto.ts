import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CancellationFeeType } from '../entities/rate-plan.entity';

// Rate plan tahrirlash — hammasi ixtiyoriy (partial update): odatda faqat
// narxni yangilash yoki isActive'ni almashtirish (deaktivatsiya) uchun ishlatiladi.
export class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumberString(
    {},
    { message: "nightlyPrice raqam ko'rinishida bo'lishi kerak" },
  )
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

  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationDeadlineDays?: number | null;

  @IsOptional()
  @IsEnum(CancellationFeeType)
  cancellationFeeType?: CancellationFeeType | null;

  @IsOptional()
  @IsNumberString(
    {},
    { message: "cancellationFeeValue raqam ko'rinishida bo'lishi kerak" },
  )
  cancellationFeeValue?: string | null;

  @IsOptional()
  @IsEnum(CancellationFeeType)
  noShowFeeType?: CancellationFeeType | null;

  @IsOptional()
  @IsNumberString(
    {},
    { message: "noShowFeeValue raqam ko'rinishida bo'lishi kerak" },
  )
  noShowFeeValue?: string | null;
}
