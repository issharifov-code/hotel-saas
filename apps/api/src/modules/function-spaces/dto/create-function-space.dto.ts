import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

export class CreateFunctionSpaceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsMoneyString('dailyRate')
  dailyRate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
