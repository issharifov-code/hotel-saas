import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MessageChannel,
  MessageTriggerType,
} from '../entities/message-template.entity';

// Hammasi ixtiyoriy (partial update) — Agencies/FunctionSpaces'dagi Update DTO
// naqshiga o'xshab.
export class UpdateMessageTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(MessageTriggerType)
  triggerType?: MessageTriggerType;

  @IsOptional()
  @IsEnum(MessageChannel)
  channel?: MessageChannel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  bodyTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
