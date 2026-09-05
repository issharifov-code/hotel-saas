import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

// Zalni tahrirlash — hammasi ixtiyoriy (partial update).
export class UpdateFunctionSpaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsMoneyString('dailyRate')
  dailyRate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
