import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PosPaymentMethod } from '../entities/pos-order.entity';

export class PayOrderDto {
  @IsEnum(PosPaymentMethod)
  paymentMethod: PosPaymentMethod;

  // paymentMethod === ROOM_ACCOUNT bo'lsa majburiy — qaysi (checked-in) bron
  // folio'siga yozilishini bildiradi.
  @IsOptional()
  @IsUUID()
  bookingId?: string;
}
