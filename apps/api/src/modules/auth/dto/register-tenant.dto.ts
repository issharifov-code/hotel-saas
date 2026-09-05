import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';
import { IsAvailableSubdomain } from '../../../common/validators/subdomain.validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(2)
  tenantName: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M10). Ilgari faqat format
  // tekshirilardi — `www`, `api`, `admin` kabi xizmat nomlarini ochiq
  // ro'yxatdan o'tish orqali band qilib olish mumkin edi. Sabablar
  // `common/validators/subdomain.validator.ts` da.
  @IsString()
  @IsAvailableSubdomain()
  subdomain: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsEmail()
  ownerEmail: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M10). Bu tizimdagi ENG NOZIK
  // parol: tenant egasi butun mehmonxona ma'lumotiga, moliyaga va
  // xodimlarga to'liq kirish huquqiga ega. Ilgari `@MinLength(8)`
  // yagona to'siq edi.
  @IsString()
  @IsStrongPassword()
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
