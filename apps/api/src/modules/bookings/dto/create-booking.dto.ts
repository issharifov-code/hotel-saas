import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { BookingSource, MarketSegment } from '../entities/booking.entity';

export class CreateBookingDto {
  @IsUUID('4')
  roomId: string;

  @IsUUID('4')
  guestId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  // Ixtiyoriy: berilsa, totalAmount shu narx rejasining nightlyPrice'idan
  // hisoblanadi (roomType.basePrice o'rniga). Rejaning xona turi tanlangan
  // xonaning turiga mos kelishi kerak — mos kelmasa xatolik qaytariladi.
  @IsOptional()
  @IsUUID('4')
  ratePlanId?: string;

  // Berilmasa, xona turi bazaviy narxi (yoki ratePlanId berilgan bo'lsa, shu
  // rejaning narxi) * tunlar soni asosida avtomatik hisoblanadi.
  @IsOptional()
  @IsNumberString()
  totalAmount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(Object.values(BookingSource))
  source?: BookingSource;

  @IsOptional()
  @IsIn(Object.values(MarketSegment))
  marketSegment?: MarketSegment;

  @IsOptional()
  @IsString()
  notes?: string;
}
