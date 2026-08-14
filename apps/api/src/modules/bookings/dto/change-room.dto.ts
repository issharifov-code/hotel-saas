import { IsUUID } from 'class-validator';

export class ChangeRoomDto {
  @IsUUID('4')
  roomId: string;
}
