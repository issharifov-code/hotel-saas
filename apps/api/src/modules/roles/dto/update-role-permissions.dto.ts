import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Bu yo'l ilgari xom
// `@Body('permissionIds') permissionIds: string[]` ni qabul qilardi.
// Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) FAQAT
// klass-DTO'ga ta'sir qiladi, ya'ni bu yerga istalgan JSON kelardi:
// `null` -> 500, satr -> `.includes()` massiv emas SATR ustida ishlab,
// kutilmagan ruxsatlarni "mos" deb topardi.
//
// `ArrayMaxSize` — ruxsatlar katalogi 65 ta; 200 keng zaxira bilan
// cheklaydi va cheksiz massiv yuborishning oldini oladi.
export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
