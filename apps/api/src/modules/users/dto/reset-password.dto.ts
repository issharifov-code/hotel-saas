import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

// Administrator tomonidan xodimga yangi parol o'rnatish (interim yechim —
// hozircha email orqali o'z-o'zini xizmat ko'rsatish (self-service) parol
// tiklash mavjud emas, Login sahifasi qayta dizayni, 2026-09).
export class ResetPasswordDto {
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M10) — parol siyosati
  // `common/validators/password.validator.ts` da izohlangan.
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
