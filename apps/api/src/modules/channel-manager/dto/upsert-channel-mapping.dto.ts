import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

// Bitta (channelId, roomTypeId) juftligi uchun xaritalashni (mapping)
// yaratadi yoki yangilaydi — UpsertRatePlanRestrictionDto bilan bir xil
// naqsh. `| null` maydonlar aniq null yuborilganda tozalanishi mumkin
// (@IsOptional() undefined VA null'ni ham tekshirishdan chetlab o'tadi).
export class UpsertChannelMappingDto {
  @IsOptional()
  @IsUUID()
  ratePlanId?: string | null;

  @IsOptional()
  @IsString()
  externalRoomTypeId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
