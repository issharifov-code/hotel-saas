import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CommunicationPreference } from '../entities/guest.entity';

// `profileType` ATAYLAB yo'q: mavjud profilning turini o'zgartirib bo'lmaydi.
// Kompaniya profilini mehmonga aylantirish uning bronlari, hisob-fakturalari
// va sodiqlik tarixini ma'nosiz qilib qo'yardi — kerak bo'lsa yangi profil
// ochib, eskisini birlashtirish (merge) to'g'ri yo'l.
export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  roomPreference?: string;

  @IsOptional()
  @IsString()
  dietaryPreference?: string;

  @IsOptional()
  @IsEnum(CommunicationPreference)
  communicationPreference?: CommunicationPreference;

  // --- Tashkilot profillari uchun -----------------------------------------

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsUUID()
  parentProfileId?: string;
}
