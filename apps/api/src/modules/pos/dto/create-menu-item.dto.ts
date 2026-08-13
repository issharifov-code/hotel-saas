import { IsBoolean, IsNumberString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsNumberString()
  price: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
