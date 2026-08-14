import { Type } from 'class-transformer';
import {
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

  @IsArray()
  @ArrayMinSize(2, { message: 'Jurnal yozuvi kamida 2 qatordan iborat bo\'lishi kerak' })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines: CreateJournalEntryLineDto[];
}
