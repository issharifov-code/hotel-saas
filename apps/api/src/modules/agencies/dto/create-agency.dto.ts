import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { IsPercentString } from '../../../common/validators/numeric-string.validator';

export class CreateAgencyDto {
  // Mavjud TURAGENT profilini ulash (2026-09-04). Berilmasa, quyidagi
  // nom/aloqadan yangi profil ochiladi — eski chaqiruvchilar buzilmasin.
  @IsOptional()
  @IsUUID()
  profileId?: string;

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
  @IsPercentString('commissionPct')
  commissionPct?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
