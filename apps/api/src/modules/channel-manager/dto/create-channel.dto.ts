import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ChannelProvider } from '../entities/channel.entity';

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(ChannelProvider)
  provider: ChannelProvider;

  @IsOptional()
  @IsString()
  externalPropertyId?: string;
}
