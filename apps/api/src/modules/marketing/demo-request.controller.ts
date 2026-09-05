import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketingService } from './marketing.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

// Login sahifasidagi "Demo so'rash" formasi — to'liq ochiq (autentifikatsiya
// yo'q), xuddi /auth/register-tenant kabi, chunki bu yerga murojaat qiluvchi
// hali hech qanday hisobga ega bo'lmasligi mumkin.
@Controller('marketing/demo-requests')
export class DemoRequestController {
  constructor(private readonly marketingService: MarketingService) {}

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05). Guardsiz yagona controller edi va
  // chegarasi ham yo'q edi: flood bilan haqiqiy sotuv lidlarini minglab
  // soxta qator ostida ko'mib yuborish mumkin edi.
  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  create(@Body() dto: CreateDemoRequestDto) {
    return this.marketingService.createDemoRequest(dto);
  }
}
