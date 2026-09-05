import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AgencyPaymentMethod } from '../entities/agency-commission-payment.entity';

export class PayAgencyCommissionsDto {
  // Qaysi komissiya qatorlari to'lanmoqda. Berilmasa — to'lanmagan
  // HAMMASI. Qisman to'lov summani bo'lish orqali emas, aynan shu
  // ro'yxat orqali bo'ladi: shunda har bir to'lov qaysi bronlarni
  // qoplaganini agentlik bilan solishtirish mumkin.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  commissionIds?: string[];

  @IsEnum(AgencyPaymentMethod, {
    message: "To'lov usuli: cash, card yoki bank_transfer",
  })
  method: AgencyPaymentMethod;

  // To'lov sanasi — provodka shu sanaga yoziladi. Berilmasa bugun.
  @IsOptional()
  @IsDateString()
  paidOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
