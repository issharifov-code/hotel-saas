import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Korporativ hisobni tahrirlash — hammasi ixtiyoriy (partial update).
export class UpdateCorporateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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
    { message: "creditLimit raqam ko'rinishida bo'lishi kerak" },
  )
  creditLimit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
