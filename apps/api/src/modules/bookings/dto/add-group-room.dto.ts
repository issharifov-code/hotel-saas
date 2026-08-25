import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Mavjud guruhga qo'shimcha xona (rooming list qatori) qo'shish — masalan
// guruh o'lchami keyinroq kattalashsa yoki boshqa sanada qo'shimcha xona
// kerak bo'lsa.
export class AddGroupRoomDto {
  @IsUUID('4')
  roomTypeId: string;

  @IsUUID('4')
  guestId: string;

  @IsOptional()
  @IsUUID('4')
  ratePlanId?: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;
}
