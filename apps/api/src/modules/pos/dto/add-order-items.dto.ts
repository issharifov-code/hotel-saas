import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreatePosOrderItemDto } from './create-pos-order.dto';

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePosOrderItemDto)
  items: CreatePosOrderItemDto[];
}
