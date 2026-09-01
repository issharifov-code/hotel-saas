import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDemoRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
