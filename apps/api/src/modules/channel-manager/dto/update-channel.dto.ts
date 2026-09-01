import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ChannelProvider } from '../entities/channel.entity';

// Kanalni tahrirlash — hammasi ixtiyoriy (partial update).
export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ChannelProvider)
  provider?: ChannelProvider;

  @IsOptional()
  @IsString()
  externalPropertyId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
