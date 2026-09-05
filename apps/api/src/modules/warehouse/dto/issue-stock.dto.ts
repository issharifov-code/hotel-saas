import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsQuantityString } from '../../../common/validators/numeric-string.validator';

export class IssueStockDto {
  @IsUUID()
  stockItemId: string;

  @IsQuantityString('quantity')
  quantity: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
