import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

// Bitta sana uchun cheklovni belgilash/yangilash — barcha maydonlar ixtiyoriy
// (partial upsert): faqat berilgan maydonlar yangilanadi, qolganlari o'zgarishsiz
// qoladi (yoki yangi yozuv uchun standart qiymatlar bilan boshlanadi).
export class UpsertRatePlanRestrictionDto {
  @IsOptional()
  @IsBoolean()
  closedToArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  closedToDeparture?: boolean;

  @IsOptional()
  @IsBoolean()
  stopSell?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minLengthOfStay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLengthOfStay?: number;
}
