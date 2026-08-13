import { IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class IssueStockDto {
  @IsUUID()
  stockItemId: string;

  @IsNumberString()
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
