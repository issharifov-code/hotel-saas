import { IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsString()
  @MinLength(1)
  roomNumber: string;

  @IsOptional()
  @IsInt()
  floor?: number;
}
