import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveMaintenanceTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNotes?: string;
}
