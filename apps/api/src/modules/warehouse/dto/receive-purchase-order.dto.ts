import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { IsQuantityString } from '../../../common/validators/numeric-string.validator';

export class ReceivePurchaseOrderLineDto {
  @IsUUID()
  purchaseOrderItemId: string;

  @IsQuantityString('quantityReceived')
  quantityReceived: string;
}

export class ReceivePurchaseOrderDto {
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines: ReceivePurchaseOrderLineDto[];
}
