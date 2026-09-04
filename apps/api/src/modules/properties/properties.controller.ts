import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { UpdatePropertyLogoDto } from './dto/update-property-logo.dto';

// `GET /properties` uchun modul-darajasidagi ruxsat talab qilinmaydi —
// deyarli har bir modul (Booking, Warehouse, POS...) frontend'da ishlashdan
// oldin propertyId'ni bilishi kerak, shuning uchun u faqat autentifikatsiya
// bilan cheklangan navigatsion ma'lumot. PermissionsGuard @RequirePermission
// qo'yilmagan route'larga avtomatik ruxsat beradi, shuning uchun guard'ni
// butun kontrollerga qo'yish eski xatti-harakatni buzmaydi.
@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.listByTenant(user.tenantId!);
  }

  // Logotipni yuklash/almashtirish. Mulkning brend ko'rinishini o'zgartiradi,
  // ya'ni bu sozlama — TENANT_SETTINGS ruxsati talab qilinadi (standart
  // rollardan faqat Egasi/Bosh menejerda bor).
  @Put(':propertyId/logo')
  @RequirePermission(PermissionModule.TENANT_SETTINGS, PermissionAction.EDIT)
  setLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePropertyLogoDto,
  ) {
    return this.propertiesService.setLogo(
      user.tenantId!,
      propertyId,
      dto.logoUrl,
    );
  }

  @Delete(':propertyId/logo')
  @RequirePermission(PermissionModule.TENANT_SETTINGS, PermissionAction.EDIT)
  removeLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertiesService.removeLogo(user.tenantId!, propertyId);
  }
}
