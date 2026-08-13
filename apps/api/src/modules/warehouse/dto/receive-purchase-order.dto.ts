import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsUUID, ValidateNested } from 'class-validator';

export class ReceivePurchaseOrderLineDto {
  @IsUUID()
  purchaseOrderItemId: string;

  @IsNumberString()
  quantityReceived: string;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines: ReceivePurchaseOrderLineDto[];
}
