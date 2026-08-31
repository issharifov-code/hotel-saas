import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { CancellationFeeType } from '../entities/rate-plan.entity';

export class CreateRatePlanDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsNumberString(
    {},
    {
      message:
        'nightlyPrice raqam ko\'rinishida bo\'lishi kerak (masalan "650000.00")',
    },
  )
  nightlyPrice: string;

  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  // Bekor qilish siyosati — hammasi ixtiyoriy. cancellationDeadlineDays
  // berilmasa (yoki cancellationFeeType/Value berilmasa), bekor qilish
  // hech qanday jarimasiz o'tadi (avvalgi xulq-atvor).
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationDeadlineDays?: number;

  @IsOptional()
  @IsEnum(CancellationFeeType)
  cancellationFeeType?: CancellationFeeType;

  @IsOptional()
  @IsNumberString(
    {},
    { message: "cancellationFeeValue raqam ko'rinishida bo'lishi kerak" },
  )
  cancellationFeeValue?: string;

  // Kelmaslik (no-show) jarimasi — muddatsiz, Night Audit tomonidan qo'llanadi.
  @IsOptional()
  @IsEnum(CancellationFeeType)
  noShowFeeType?: CancellationFeeType;

  @IsOptional()
  @IsNumberString(
    {},
    { message: "noShowFeeValue raqam ko'rinishida bo'lishi kerak" },
  )
  noShowFeeValue?: string;
}
