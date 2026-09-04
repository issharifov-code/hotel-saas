import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Logotip `data:` URL sifatida keladi (fayl emas) — shuning uchun oddiy JSON
// so'rov, multipart/multer kerak emas. Rasm brauzerda 256px'gacha
// kichraytirilib, PNG'ga aylantiriladi (qarang web/src/lib/image.ts), lekin
// mijozga ishonib bo'lmaydi — bu yerda tur ham, hajm ham qayta tekshiriladi.

// Faqat rasm turlari va faqat base64 kodlash. `data:text/html;base64,...`
// kabi qiymatlar o'tmasligi uchun MIME ro'yxati aniq cheklangan.
export const LOGO_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// ~400KB base64 ≈ ~300KB rasm. 256px logotip odatda 20-60KB, ya'ni bu
// chegara keng zaxira bilan. main.ts'dagi JSON body chegarasi (1mb) shundan
// kattaroq bo'lishi shart — aks holda so'rov DTO'ga yetib kelmaydi.
export const LOGO_MAX_LENGTH = 400_000;

export class UpdatePropertyLogoDto {
  @IsString()
  @MinLength(32, { message: "Logotip ma'lumoti juda qisqa yoki buzilgan" })
  @MaxLength(LOGO_MAX_LENGTH, {
    message: 'Logotip hajmi juda katta (maksimum ~300KB)',
  })
  @Matches(LOGO_DATA_URL_PATTERN, {
    message:
      "Logotip faqat PNG, JPEG yoki WebP rasm bo'lishi kerak (data: URL, base64)",
  })
  logoUrl: string;
}
