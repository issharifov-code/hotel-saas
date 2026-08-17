import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

// Platforma admin tomonidan bitta tenant uchun keyingi obuna davri hisob-fakturasini
// qo'lda yaratish (avtomatik oylik generatsiya hali yo'q — kelajakda cron/scheduler
// bilan almashtirilishi mumkin).
export class GenerateInvoiceDto {
  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
