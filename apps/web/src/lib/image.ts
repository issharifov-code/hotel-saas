// Rasmni brauzerda kichraytirib, `data:` URL'ga aylantirish.
//
// NIMA UCHUN BRAUZERDA: mehmonxona logotipi bazada matn sifatida saqlanadi
// (Render API'sida doimiy disk yo'q — qarang AddPropertyLogo migratsiyasi).
// Rasmni shu yerda kichraytirsak: (1) backend'ga multipart/multer kerak
// emas, oddiy JSON so'rov yetadi; (2) `sharp` kabi og'ir native kutubxona
// serverga qo'shilmaydi; (3) tarmoqqa faqat kichik hajm chiqadi.
// Backend baribir turini va hajmini qayta tekshiradi — bu qulaylik, himoya
// emas.

export const LOGO_MAX_DIMENSION = 256;

// Backend'dagi LOGO_MAX_LENGTH (400_000) bilan mos — undan oldin, foydali
// xabar bilan to'xtatish uchun.
export const LOGO_MAX_DATA_URL_LENGTH = 400_000;

export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("Rasmni o'qib bo'lmadi — fayl buzilgan bo'lishi mumkin"));
    };
    img.src = url;
  });
}

/**
 * Faylni eng ko'pi `maxDimension` px bo'lgan PNG `data:` URL'ga aylantiradi.
 * Nisbati saqlanadi; kichik rasm kattalashtirilmaydi.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDimension: number = LOGO_MAX_DIMENSION,
): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new ImageError('Faqat PNG, JPEG yoki WebP rasm yuklash mumkin');
  }

  const img = await loadImage(file);

  // Kichik rasmni kattalashtirmaymiz — sifat yomonlashadi, hajm esa oshadi.
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError("Brauzer rasmni qayta ishlay olmadi");
  // PNG shaffoflikni saqlaydi — logotiplar odatda shaffof fonli bo'ladi,
  // shuning uchun fon bo'yalmaydi.
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/png');

  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) {
    throw new ImageError(
      'Rasm juda katta — soddaroq yoki kichikroq logotip tanlang',
    );
  }

  return dataUrl;
}
