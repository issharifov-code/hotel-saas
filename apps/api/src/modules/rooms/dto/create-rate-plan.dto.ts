import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRatePlanDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsNumberString({}, { message: "nightlyPrice raqam ko'rinishida bo'lishi kerak (masalan \"650000.00\")" })
  nightlyPrice: string;

  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
