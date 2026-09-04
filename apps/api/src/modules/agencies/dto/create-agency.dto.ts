import {
  IsEmail,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

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
  @IsNumberString({}, { message: "commissionPct raqam ko'rinishida bo'lishi kerak (masalan \"10.00\")" })
  commissionPct?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
