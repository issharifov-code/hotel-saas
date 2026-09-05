import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsMoneyString, IsPercentString } from '../../../common/validators/numeric-string.validator';

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
  @IsMoneyString('roomsRevenue')
  roomsRevenue?: string | null;

  @IsOptional()
  @IsPercentString('occupancyRatePct')
  occupancyRatePct?: string | null;

  @IsOptional()
  @IsMoneyString('adr')
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
