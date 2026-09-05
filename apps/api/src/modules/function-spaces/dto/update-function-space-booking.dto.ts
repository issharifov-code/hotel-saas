import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { FunctionSpaceBookingStatus } from '../entities/function-space-booking.entity';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

// Tadbir bronini tahrirlash — hammasi ixtiyoriy (partial update). Vaqt yoki
// zal o'zgarsa (va status CANCELLED bo'lmasa), backend to'qnashuvni qayta
// tekshiradi.
export class UpdateFunctionSpaceBookingDto {
  @IsOptional()
  @IsUUID('4')
  functionSpaceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  eventName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  organizerName?: string;

  @IsOptional()
  @IsString()
  organizerPhone?: string;

  @IsOptional()
  @IsEmail()
  organizerEmail?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attendeeCount?: number;

  @IsOptional()
  @IsString()
  setupStyle?: string;

  @IsOptional()
  @IsIn(Object.values(FunctionSpaceBookingStatus))
  status?: FunctionSpaceBookingStatus;

  @IsOptional()
  @IsMoneyString('totalAmount')
  totalAmount?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
