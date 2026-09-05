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

export class CreateFunctionSpaceBookingDto {
  @IsUUID('4')
  functionSpaceId: string;

  @IsString()
  @MinLength(1)
  eventName: string;

  @IsString()
  @MinLength(1)
  organizerName: string;

  @IsOptional()
  @IsString()
  organizerPhone?: string;

  @IsOptional()
  @IsEmail()
  organizerEmail?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attendeeCount?: number;

  @IsOptional()
  @IsString()
  setupStyle?: string;

  // Berilmasa, standart CONFIRMED bilan yaratiladi.
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
