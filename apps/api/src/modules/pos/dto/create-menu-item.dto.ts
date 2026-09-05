import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsMoneyString('price')
  price: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
