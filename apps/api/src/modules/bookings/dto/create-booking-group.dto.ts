import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateGroupRoomItemDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsUUID('4')
  guestId: string;

  @IsOptional()
  @IsUUID('4')
  ratePlanId?: string;
}

export class CreateBookingGroupDto {
  @IsString()
  @MaxLength(200)
  groupName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Guruhdagi barcha xonalar uchun umumiy sana oralig'i (MVP — har bir xona
  // uchun alohida sana kerak bo'lsa, keyinchalik guruhga qo'shimcha xona
  // qo'shish endpoint'i orqali boshqa sanalar bilan ham qo'shish mumkin).
  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateGroupRoomItemDto)
  rooms: CreateGroupRoomItemDto[];
}
