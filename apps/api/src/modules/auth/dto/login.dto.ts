import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Tenant xodimlari uchun subdomain talab qilinadi (bir xil email turli tenant'larda bo'lishi mumkin).
  // Platforma super-admin uchun subdomain kerak emas.
  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
