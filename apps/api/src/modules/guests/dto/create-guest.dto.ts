import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CommunicationPreference } from '../entities/guest.entity';

export class CreateGuestDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  roomPreference?: string;

  @IsOptional()
  @IsString()
  dietaryPreference?: string;

  @IsOptional()
  @IsEnum(CommunicationPreference)
  communicationPreference?: CommunicationPreference;
}
