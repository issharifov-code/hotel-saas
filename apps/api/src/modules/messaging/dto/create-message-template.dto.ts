import {
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

export class CreateMessageTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsEnum(MessageTriggerType)
  triggerType?: MessageTriggerType;

  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  bodyTemplate: string;
}
