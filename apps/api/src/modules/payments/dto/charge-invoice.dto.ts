import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ChargeInvoiceDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  // Qaysi to'lov shlyuzi adapteri ishlatilishi kerak. Ko'rsatilmasa 'mock'
  // ishlatiladi (hozircha yagona amalga oshirilgan adapter).
  @IsOptional()
  @IsString()
  provider?: string;
}
