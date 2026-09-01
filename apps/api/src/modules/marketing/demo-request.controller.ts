import { Body, Controller, Post } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

// Login sahifasidagi "Demo so'rash" formasi — to'liq ochiq (autentifikatsiya
// yo'q), xuddi /auth/register-tenant kabi, chunki bu yerga murojaat qiluvchi
// hali hech qanday hisobga ega bo'lmasligi mumkin.
@Controller('marketing/demo-requests')
export class DemoRequestController {
  constructor(private readonly marketingService: MarketingService) {}

  @Post()
  create(@Body() dto: CreateDemoRequestDto) {
    return this.marketingService.createDemoRequest(dto);
  }
}
