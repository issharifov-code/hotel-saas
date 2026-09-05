import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsPercentString } from '../../../common/validators/numeric-string.validator';

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
  @IsPercentString('commissionPct')
  commissionPct?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
