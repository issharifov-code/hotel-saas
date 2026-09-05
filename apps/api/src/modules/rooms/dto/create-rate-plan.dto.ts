import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { CancellationFeeType } from '../entities/rate-plan.entity';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

export class CreateRatePlanDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsMoneyString('nightlyPrice')
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
  @IsMoneyString('cancellationFeeValue')
  cancellationFeeValue?: string;

  // Kelmaslik (no-show) jarimasi — muddatsiz, Night Audit tomonidan qo'llanadi.
  @IsOptional()
  @IsEnum(CancellationFeeType)
  noShowFeeType?: CancellationFeeType;

  @IsOptional()
  @IsMoneyString('noShowFeeValue')
  noShowFeeValue?: string;
}
