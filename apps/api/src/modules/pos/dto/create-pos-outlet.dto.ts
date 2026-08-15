import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePosOutletDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;
}
