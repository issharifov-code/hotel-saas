import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePayslipEntryDto {
  // Faqat HOURLY turdagi xodim uchun qabul qilinadi.
  @IsOptional()
  @IsNumber()
  @Min(0)
  hoursWorked?: number;

  // Musbat (bonus) yoki manfiy (ushlab qolish) bo'lishi mumkin.
  @IsOptional()
  @IsNumber()
  adjustmentAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adjustmentNote?: string;
}
