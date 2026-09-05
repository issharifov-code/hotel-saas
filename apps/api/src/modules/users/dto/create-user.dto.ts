import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M10) — parol siyosati
  // `common/validators/password.validator.ts` da izohlangan.
  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;
}
