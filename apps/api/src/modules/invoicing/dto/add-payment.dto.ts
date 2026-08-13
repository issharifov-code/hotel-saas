import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { InvoicePaymentMethod } from '../entities/invoice-payment.entity';

export class AddPaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(InvoicePaymentMethod)
  method: InvoicePaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
