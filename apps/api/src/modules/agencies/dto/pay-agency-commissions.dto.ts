import {
  ArrayMaxSize,
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
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Yuqori chegara yo'q edi:
  // 1 MB'lik so'rov tanasiga ~15-20 ming element sig'adi va ularning
  // har biri bitta so'rov tranzaksiyasida qator sifatida yoziladi.
  // RLS tranzaksiyalari so'rovga xos bo'lgani uchun bir nechta shunday
  // so'rov ulanishlar hovuzini tugatib qo'yardi (arzon DoS).
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
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
