import { IsBoolean } from 'class-validator';

export class MarkContactedDto {
  @IsBoolean()
  contacted: boolean;
}
