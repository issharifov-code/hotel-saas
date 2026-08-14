import { IsDateString } from 'class-validator';

export class UpdateBookingDatesDto {
  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;
}
