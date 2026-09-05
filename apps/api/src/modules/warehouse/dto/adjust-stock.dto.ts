import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IsSignedQuantityString } from '../../../common/validators/numeric-string.validator';

export class AdjustStockDto {
  @IsUUID()
  stockItemId: string;

  // Musbat yoki manfiy bo'lishi mumkin (masalan "-2.5" — yo'qotish, "3" — ortiqcha topilgan)
  @IsSignedQuantityString('quantity')
  quantity: string;

  // Inventarizatsiya tuzatishi sababi majburiy — audit uchun
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
