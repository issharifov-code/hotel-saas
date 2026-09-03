import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '../entities/attendance-record.entity';

export class UpsertAttendanceDto {
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hoursWorked?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
