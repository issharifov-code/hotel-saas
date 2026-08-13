import { IsEnum } from 'class-validator';
import { PosPaymentMethod } from '../entities/pos-order.entity';

export class PayOrderDto {
  @IsEnum(PosPaymentMethod)
  paymentMethod: PosPaymentMethod;
}
