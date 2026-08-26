import { IsBoolean, IsEmail, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

// Agentlikni tahrirlash — hammasi ixtiyoriy (partial update).
export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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
  @IsNumberString({}, { message: "commissionPct raqam ko'rinishida bo'lishi kerak" })
  commissionPct?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
