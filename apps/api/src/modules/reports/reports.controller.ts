import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RolesService } from '../roles/roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import { parsePagination } from '../../common/utils/pagination.util';
import { parseDaysParam } from '../../common/utils/days-param.util';
import { DismissInsightDto } from './dto/dismiss-insight.dto';

@Controller('properties/:propertyId/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    // Tavsiyalar panelida budjet qismini shartli qo'shish uchun — qarang
    // `insights()` izohi.
    private readonly rolesService: RolesService,
  ) {}

  @Get('overview')
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('days') days?: string,
  ) {
    const periodDays = parseDaysParam(days);
    return this.reportsService.getOverview(
      user.tenantId!,
      propertyId,
      periodDays,
    );
  }

  // Tavsiyalar paneli. REPORTS:VIEW yetarli — tavsiyalarning ko'pchiligi
  // operatsion (bandlik, tozalash navbati, texnik zayavkalar).
  //
  // LEKIN budjetdan chetlanish tavsiyasi nozik moliyaviy ma'lumot, shuning
  // uchun u faqat foydalanuvchida ACCOUNTING:VIEW ham bo'lsa qo'shiladi.
  // Ruxsatni shu yerda tekshiramiz (guard emas): guard butun endpointni
  // bloklaydi, bizga esa javobning bir qismini shartli qo'shish kerak.
  @Get('insights')
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  async insights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('days') days?: string,
  ) {
    const periodDays = parseDaysParam(days);
    const permissions = await this.rolesService.getEffectivePermissions(
      user.tenantId!,
      user.userId,
      propertyId,
    );
    const includeBudget =
      user.isPlatformAdmin || permissions.has('accounting:view');

    return this.reportsService.getInsights(
      user.tenantId!,
      propertyId,
      user.userId,
      periodDays,
      includeBudget,
    );
  }

  // Tavsiyani "e'tiborga oldim" deb yopish.
  //
  // Ruxsat — REPORTS:VIEW, ya'ni tavsiyani KO'RA oladigan har kim uni o'zi
  // uchun yopa ham oladi. Alohida EDIT ruxsati ataylab talab qilinmaydi:
  // yopish hech kimning ma'lumotini o'zgartirmaydi va faqat yopgan odamning
  // o'z ko'rinishiga ta'sir qiladi (`user.userId` bo'yicha saqlanadi).
  @Post('insights/:insightId/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  async dismissInsight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('insightId') insightId: string,
    @Body() dto: DismissInsightDto,
  ) {
    await this.reportsService.dismissInsight(
      user.tenantId!,
      propertyId,
      user.userId,
      insightId,
      dto.severity,
    );
  }

  // Yopilganlarni qaytarish. `insightId` berilmasa — shu mulkdagi barcha
  // yopishlar tozalanadi ("Hammasini qaytarish" havolasi).
  @Delete('insights/dismissals')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  async restoreInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('insightId') insightId?: string,
  ) {
    await this.reportsService.restoreInsights(
      user.tenantId!,
      propertyId,
      user.userId,
      insightId,
    );
  }

  // "Reja vs haqiqat". ACCOUNTING ruxsati talab qilinadi (REPORTS emas) —
  // javob budjet raqamlarini oshkor qiladi, ular esa Budjet sahifasi bilan
  // bir xil darajada nozik. Aks holda REPORTS:VIEW bor xodim budjetni
  // sahifadan ko'ra olmasa-da, shu endpoint orqali ko'rib olardi.
  @Get('budget-performance')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  budgetPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('year') year?: string,
  ) {
    const parsed = Number(year);
    const resolved =
      Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
        ? parsed
        : new Date().getUTCFullYear();
    return this.reportsService.getBudgetPerformance(
      user.tenantId!,
      propertyId,
      resolved,
    );
  }

  @Get('segment-performance')
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  segmentPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('days') days?: string,
  ) {
    const periodDays = parseDaysParam(days);
    return this.reportsService.getSegmentPerformance(
      user.tenantId!,
      propertyId,
      periodDays,
    );
  }

  @Get('guest-registration')
  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  guestRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const periodDays = parseDaysParam(days);
    return this.reportsService.getGuestRegistrationReport(
      user.tenantId!,
      propertyId,
      periodDays,
      parsePagination(page, pageSize, 50),
    );
  }
}
