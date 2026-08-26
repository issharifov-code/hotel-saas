import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaintenanceTicketPriority } from '../entities/maintenance-ticket.entity';

export class CreateMaintenanceTicketDto {
  @IsUUID()
  roomId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsIn(Object.values(MaintenanceTicketPriority))
  priority?: MaintenanceTicketPriority;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
