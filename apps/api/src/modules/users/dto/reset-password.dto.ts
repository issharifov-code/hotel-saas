import { IsString, MinLength } from 'class-validator';

// Administrator tomonidan xodimga yangi parol o'rnatish (interim yechim —
// hozircha email orqali o'z-o'zini xizmat ko'rsatish (self-service) parol
// tiklash mavjud emas, Login sahifasi qayta dizayni, 2026-09).
export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  newPassword: string;
}
