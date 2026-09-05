import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsQuantityString } from '../../../common/validators/numeric-string.validator';

export class CreateStockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsQuantityString('reorderPoint')
  reorderPoint?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
