import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

// Jonli (autentifikatsiyasiz) bron widget'idan yuboriladigan so'rov —
// mehmon ANIQ xonani emas, faqat xona TURINI tanlaydi (birinchi bo'sh xona
// backend tomonidan avtomatik tayinlanadi, `BookingsService.createFromWebsite`ga qarang).
export class PublicCreateBookingDto {
  @IsUUID()
  roomTypeId: string;

  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsString()
  @MinLength(2)
  guestFullName: string;

  // Kamida bittasi (telefon yoki email) berilishi shart — bu servis darajasida
  // tekshiriladi (ikkalasi ham ixtiyoriy DTO darajasida, chunki class-validator
  // "kamida bittasi" shartini deklarativ ravishda ifodalash qiyin).
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
