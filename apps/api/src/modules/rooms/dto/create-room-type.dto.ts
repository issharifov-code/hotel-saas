import { IsInt, IsNumberString, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumberString({}, { message: "basePrice raqam ko'rinishida bo'lishi kerak (masalan \"350000.00\")" })
  basePrice: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
