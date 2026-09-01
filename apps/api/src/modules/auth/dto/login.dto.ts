import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Ixtiyoriy: Login sahifasida endi ko'rsatilmaydi (2026-09 qayta dizayn) —
  // tenant email orqali avtomatik aniqlanadi (AuthService.loginWithoutSubdomain).
  // Bir xil email bir nechta tenant'da bo'lib, parol ham mos kelib qolsa,
  // frontend mehmonxona tanlash qadamidan keyin buni to'ldirib qayta yuboradi.
  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
