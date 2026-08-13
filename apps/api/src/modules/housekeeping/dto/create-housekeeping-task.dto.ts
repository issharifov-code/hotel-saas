import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHousekeepingTaskDto {
  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
