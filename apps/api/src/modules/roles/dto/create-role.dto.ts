import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name: string;

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
