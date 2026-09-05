import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

export class CreateRoomTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsMoneyString('basePrice')
  basePrice: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
