import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Bu ikki yo'l ochiq va ilgari
  // hech qanday chegarasi yo'q edi.
  //
  // Ro'yxatdan o'tish har chaqiruvda tenant + standart mulk + 6 ta rol +
  // to'liq namunaviy dataset yaratadi (yuzlab insert) va subdomainni
  // abadiy band qiladi — ya'ni skript bilan bazani ham to'ldirish, ham
  // istalgan nomni egallab olish mumkin edi. Soatiga 3 ta yetarli:
  // haqiqiy mehmonxona bir marta ro'yxatdan o'tadi.
  @Post('register-tenant')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  // Login `subdomain`siz ishlaydi, ya'ni hujumchiga faqat email kerak edi —
  // cheksiz parol tanlash (jumladan platforma admini uchun). 15 daqiqada
  // 10 ta urinish odam uchun yetarli, skript uchun foydasiz.
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low — L9). Ilgari "chiqish"
  // faqat frontend amali edi — token localStorage'dan o'chirilardi,
  // serverda esa 8 soat amal qilaverardi. Endi chiqish `token_version`
  // ni oshiradi, ya'ni o'sha foydalanuvchining barcha tokenlari
  // (boshqa qurilmalardagi ham) darhol kuchini yo'qotadi. Batafsil
  // izoh — `UsersService.revokeSessions`.
  //
  // `HttpCode(204)`: javobda qaytariladigan hech narsa yo'q va
  // frontend natijani kutmasdan ham chiqib ketishi mumkin.
  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.revokeSessions(user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.usersService.findById(user.userId);
    // Booking Engine (jonli bron widget'i) havolasini xodimga ko'rsatish
    // uchun — frontend `/book/:subdomain` sahifasiga havola quradi.
    const tenant = fullUser?.tenantId
      ? await this.tenantsService.findById(fullUser.tenantId)
      : null;
    return {
      id: fullUser?.id,
      email: fullUser?.email,
      fullName: fullUser?.fullName,
      tenantId: fullUser?.tenantId,
      tenantSubdomain: tenant?.subdomain ?? null,
      hasSampleData: tenant?.hasSampleData ?? false,
      isPlatformAdmin: fullUser?.isPlatformAdmin,
    };
  }
}
