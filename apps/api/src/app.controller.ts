import { Controller, Get } from '@nestjs/common';
import { AppService, VersionInfo } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /api/version — deploy holatini tekshirish uchun (2026-09-05).
  //
  // ATAYLAB autentifikatsiyasiz: uning butun ma'nosi "deploy chiqdimi?"
  // degan savolga tashqaridan, bir so'rov bilan javob berish (Render
  // health check ham shu yerga qarashi mumkin). Hech qanday maxfiy
  // ma'lumot qaytmaydi — kommit SHA'si, jarayon ishga tushgan vaqt va
  // sxema timestamp'i (izohlar `AppService`da).
  @Get('version')
  getVersion(): Promise<VersionInfo> {
    return this.appService.getVersion();
  }
}
