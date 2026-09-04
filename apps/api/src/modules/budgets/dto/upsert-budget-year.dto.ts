import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumberString,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BudgetMonthDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  // Pul/foiz qiymatlari matn sifatida (numeric ustunlar bilan mos, float
  // xatoliklarisiz). `null` — "bu ko'rsatkich rejalashtirilmagan": foydalanuvchi
  // maydonni bo'shatsa, mavjud qiymat o'chirilishi kerak, shuning uchun
  // `undefined` (umuman yubormaslik) bilan farqlanadi.
  @IsOptional()
  @IsNumberString({}, { message: "Daromad raqam ko'rinishida bo'lishi kerak" })
  roomsRevenue?: string | null;

  @IsOptional()
  @IsNumberString({}, { message: "Bandlik raqam ko'rinishida bo'lishi kerak" })
  occupancyRatePct?: string | null;

  @IsOptional()
  @IsNumberString({}, { message: "ADR raqam ko'rinishida bo'lishi kerak" })
  adr?: string | null;
}

// Butun yil bitta so'rovda saqlanadi — UI 12 oylik jadval bo'lgani uchun
// bu 12 ta alohida so'rovdan ancha qulay va atomik (bitta tranzaksiya).
export class UpsertBudgetYearDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => BudgetMonthDto)
  months: BudgetMonthDto[];
}
