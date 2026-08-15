import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

// Qo'lda ball tuzatish — musbat `points` = qo'shish, manfiy = ayirish.
// 0 ruxsat etilmaydi (bu holda tranzaksiya yozib bo'lmaydi, chunki hech narsa o'zgarmaydi).
export class AdjustLoyaltyPointsDto {
  @IsInt()
  @NotEquals(0)
  points: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}
