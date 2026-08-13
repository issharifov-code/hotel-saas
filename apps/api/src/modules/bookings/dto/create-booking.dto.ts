import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { BookingSource } from '../entities/booking.entity';

export class CreateBookingDto {
  @IsUUID('4')
  roomId: string;

  @IsUUID('4')
  guestId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  // Berilmasa, xona turi bazaviy narxi * tunlar soni asosida avtomatik hisoblanadi.
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
  @IsString()
  notes?: string;
}
