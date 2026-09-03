import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(2)
  tenantName: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, {
    message:
      "subdomain faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak",
  })
  subdomain: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  ownerPassword: string;

  @IsString()
  @MinLength(2)
  ownerFullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerPosition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roomsCountHint?: string;
}
