import { MigrationInterface, QueryRunner } from 'typeorm';

// Mehmonxonaning o'z logotipi (2026-09-04). Avval yuqori panelda faqat
// nomining bosh harfi bilan vaqtinchalik piktogramma ko'rsatilardi
// (AppLayout `propertyInitial()`), endi haqiqiy rasm yuklash mumkin.
//
// NIMA UCHUN BAZADA, FAYL SIFATIDA EMAS: Render'dagi API xizmati `starter`
// rejada, unga doimiy disk ulanmagan — fayl tizimi vaqtinchalik, har
// deploy'da tozalanadi. Ya'ni diskka yozilgan rasm birinchi deploy'dayoq
// yo'qolardi. Tashqi obyekt-xotira (S3/R2) esa alohida hisob va oylik
// to'lov talab qiladi. Har bir mulk uchun bitta kichik logotip (~20-40KB)
// bo'lgani sababli, uni to'g'ridan-to'g'ri bazada `data:` URL matni
// sifatida saqlash eng sodda va arzon yechim (foydalanuvchi qarori).
//
// Ustun nomi ataylab `logo_url` — hozir `data:image/...;base64,...` matni
// saqlanadi, lekin kelajakda S3/CDN'ga o'tilsa, oddiy `https://...` havola
// bilan almashtirish uchun ma'lumot turi ham, nomi ham mos keladi.
export class AddPropertyLogo1788100000000 implements MigrationInterface {
  name = 'AddPropertyLogo1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" ADD COLUMN "logo_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "logo_url"`,
    );
  }
}
