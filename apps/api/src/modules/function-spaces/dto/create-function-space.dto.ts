import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFunctionSpaceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsNumberString(
    {},
    {
      message:
        'dailyRate raqam ko\'rinishida bo\'lishi kerak (masalan "500000.00")',
    },
  )
  dailyRate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
