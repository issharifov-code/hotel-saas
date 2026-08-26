import { IsEmail, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAgencyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsNumberString({}, { message: "commissionPct raqam ko'rinishida bo'lishi kerak (masalan \"10.00\")" })
  commissionPct?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
