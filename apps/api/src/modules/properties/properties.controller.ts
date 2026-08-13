import { Controller, Get, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

// Modul-darajasidagi ruxsat talab qilinmaydi — deyarli har bir modul (Booking,
// Warehouse, POS...) frontend'da ishlashdan oldin propertyId'ni bilishi kerak,
// shuning uchun bu faqat autentifikatsiya bilan cheklangan navigatsion ma'lumot.
@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.listByTenant(user.tenantId!);
  }
}
