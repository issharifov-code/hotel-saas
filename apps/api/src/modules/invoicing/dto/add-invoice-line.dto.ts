import { IsNumber, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class AddInvoiceLineDto {
  @IsString()
  @MaxLength(255)
  description: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @IsPositive()
  unitPrice: number;
}
