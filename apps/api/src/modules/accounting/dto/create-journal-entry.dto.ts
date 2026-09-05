import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateJournalEntryLineDto {
  @IsUUID('4')
  accountId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

// Buxgalter tomonidan qo'lda kiritiladigan yozuv (masalan ish haqi, ijara,
// amortizatsiya) — avtomatik provodka qamrab olmaydigan holatlar uchun.
export class CreateJournalEntryDto {
  @IsDateString()
  entryDate: string;

  @IsString()
  @MaxLength(255)
  description: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayMinSize(2, { message: 'Jurnal yozuvi kamida 2 qatordan iborat bo\'lishi kerak' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines: CreateJournalEntryLineDto[];
}
