import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CommunicationPreference, ProfileType } from '../entities/guest.entity';

export class CreateGuestDto {
  // 2026-09-04: profil turi. Berilmasa `guest` — eski chaqiruvlar (bron
  // widget'i, seed, testlar) o'zgarishsiz ishlashi uchun.
  @IsOptional()
  @IsEnum(ProfileType)
  profileType?: ProfileType;

  // Jismoniy shaxsda to'liq ism, tashkilotda tashkilot nomi.
  @IsString()
  @MinLength(2)
  fullName: string;

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

  // Turagent komissiyasi (%). Faqat TRAVEL_AGENT turida ruxsat etiladi —
  // buni GuestsService tekshiradi (bu yerda faqat oraliq tekshiriladi).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number;

  // Kontakt profilining tashkiloti.
  @IsOptional()
  @IsUUID()
  parentProfileId?: string;
}
