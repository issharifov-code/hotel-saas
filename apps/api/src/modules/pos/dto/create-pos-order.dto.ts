import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreatePosOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CreatePosOrderDto {
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreatePosOrderItemDto)
  items: CreatePosOrderItemDto[];

  // Ixtiyoriy: buyurtma qaysi savdo nuqtasida ochilishini aniq ko'rsatish uchun
  // (bir nechta outlet bo'lgan mulklarda). Ko'rsatilmasa, default outlet ishlatiladi.
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNumber?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
