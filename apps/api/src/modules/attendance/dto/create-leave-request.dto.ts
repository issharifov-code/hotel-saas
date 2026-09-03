import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LeaveType } from '../entities/leave-request.entity';

export class CreateLeaveRequestDto {
  @IsUUID()
  userId: string;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsISO8601({ strict: true })
  startDate: string;

  @IsISO8601({ strict: true })
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
