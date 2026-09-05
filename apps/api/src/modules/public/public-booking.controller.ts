import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicBookingService } from './public-booking.service';
import { PublicTenantGuard } from './public-tenant.guard';
import { PublicCreateBookingDto } from './dto/public-create-booking.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

// Ochiq (autentifikatsiyasiz) to'g'ridan-to'g'ri bron widget'i — mehmonxonaning
// o'z veb-saytiga joylashtirish yoki ijtimoiy tarmoqlarda ulashish uchun
// mo'ljallangan (frontend'dagi `/book/:subdomain` sahifasi shu API'ga
// murojaat qiladi). Boshqa barcha controller'lardan farqli, bu yerda
// JwtAuthGuard/PermissionsGuard O'RNIGA PublicTenantGuard ishlatiladi —
// autentifikatsiya email/parol orqali emas, faqat URL'dagi subdomain orqali
// (RLS tenant konteksti xuddi shu tarzda o'rnatiladi, PublicTenantGuard'ga qarang).
@Controller('public/:subdomain')
@UseGuards(PublicTenantGuard)
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get('properties')
  listProperties(@CurrentUser() user: AuthenticatedUser) {
    return this.publicBookingService.listProperties(user.tenantId!);
  }

  @Get('properties/:propertyId/availability')
  getAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.publicBookingService.getAvailability(
      user.tenantId!,
      propertyId,
      checkIn,
      checkOut,
    );
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Bu autentifikatsiyasiz YOZUV
  // yo'li. Vidjetdan kelgan bron `PENDING` holatida yaratiladi, `PENDING`
  // esa xona bandligini bloklaydi — ya'ni skript bilan mehmonxonaning
  // butun inventarini bron qilib bo'lmaydigan holga keltirish mumkin edi.
  // Soatiga 10 ta: haqiqiy mehmon bir-ikki marta bron qiladi.
  @Post('properties/:propertyId/bookings')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: PublicCreateBookingDto,
  ) {
    return this.publicBookingService.createBooking(
      user.tenantId!,
      propertyId,
      dto,
    );
  }
}
