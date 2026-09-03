import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
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

@Controller('properties/:propertyId/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
