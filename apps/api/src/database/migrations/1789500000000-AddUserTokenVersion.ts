import { MigrationInterface, QueryRunner } from 'typeorm';

// Token bekor qilish (2026-09-05, kod auditining oxirgi ochiq topilmasi).
//
// MUAMMO. Administrator xodimni "bloklangan" qilganda, `AuthService`
// unga YANGI token bermaydi — lekin allaqachon berilgan token amal
// qilish muddati tugagunicha (8 soat) ishlayveradi. Ya'ni ishdan
// bo'shatilgan xodim yarim ish kuni davomida tizimga kira oladi.
// Parol almashtirilganda ham xuddi shunday: eski sessiya tirik qoladi.
//
// YECHIM. Har bir foydalanuvchida `token_version` hisoblagichi turadi va
// u token ichiga (`tv`) yoziladi. Har so'rovda JWT'dagi `tv` bazadagi
// qiymat bilan solishtiriladi; mos kelmasa token yaroqsiz. Statusni
// o'zgartirish yoki parolni almashtirish hisoblagichni oshiradi, ya'ni
// o'sha foydalanuvchining BARCHA eski tokenlari bir zumda kuchini
// yo'qotadi.
//
// Nima uchun aynan hisoblagich (qora ro'yxat emas): bekor qilingan
// tokenlarni saqlash uchun alohida jadval va tozalash ishi kerak
// bo'lardi; hisoblagich esa bitta butun son va foydalanuvchi qatorining
// o'zida turadi.
//
// Boshlang'ich qiymat 0. Bu ATAYLAB tanlangan: shu deploy paytida
// amal qilayotgan eski tokenlarda `tv` umuman yo'q, va strategiya
// yo'qligini 0 deb hisoblaydi — ya'ni deploy hech kimni tizimdan
// chiqarib yubormaydi.
export class AddUserTokenVersion1789500000000 implements MigrationInterface {
  name = 'AddUserTokenVersion1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"`,
    );
  }
}
