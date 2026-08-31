import {
  IsEmail,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCorporateAccountDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsNumberString(
    {},
    {
      message:
        'creditLimit raqam ko\'rinishida bo\'lishi kerak (masalan "5000000.00")',
    },
  )
  creditLimit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
