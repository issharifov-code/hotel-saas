import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MessageChannel } from '../entities/message-template.entity';

// Xabar yuborish — ikki rejim: (1) `templateId` berilsa, shablon
// render qilinadi (bookingId berilgan bo'lsa bron maydonlari bilan ham);
// (2) `templateId` berilmasa, `body` (va ixtiyoriy `subject`) to'g'ridan-to'g'ri
// erkin (ad-hoc) xabar sifatida yuboriladi. Ikkalasi ham berilmasa —
// MessagingService BadRequestException tashlaydi (class-validator darajasida
// bu shartli talabni ifodalash qiyin, shuning uchun servis darajasida
// tekshiriladi).
export class SendMessageDto {
  @IsUUID()
  guestId: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  // Guest.communicationPreference'ni ustidan yozib qo'yish uchun (masalan
  // mehmon afzalligi PHONE/NONE bo'lsa, xodim aniq EMAIL/SMS tanlashi kerak).
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
  body?: string;
}
