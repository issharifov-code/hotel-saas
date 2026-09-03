import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Davomat — mavjud PermissionModule.PAYROLL qayta ishlatildi (Night Audit/
// Group Booking'dagi bir xil naqsh): xodimning ish soatlari maosh hisob-
// kitobiga bevosita ta'sir qiladi, shuning uchun kim maoshni ko'ra olsa
// (Egasi/Buxgalter), o'sha davomatni ham yuritadi.
@Controller('properties/:propertyId/attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('staff')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  listStaffRoster(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.listStaffRoster(user.tenantId!);
  }

  @Get()
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  listForDate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.listForDate(user.tenantId!, propertyId, date);
  }

  @Get('summary')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  getMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('userId') userId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.attendanceService
      .getMonthlyHours(
        user.tenantId!,
        propertyId,
        userId,
        Number(year),
        Number(month),
      )
      .then((totalHours) => ({ totalHours }));
  }

  @Get('user/:userId')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  listForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.attendanceService.listForUser(
      user.tenantId!,
      propertyId,
      userId,
      from,
      to,
    );
  }

  @Put(':userId/:date')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('userId') userId: string,
    @Param('date') date: string,
    @Body() dto: UpsertAttendanceDto,
  ) {
    return this.attendanceService.upsert(
      user.tenantId!,
      propertyId,
      user.userId,
      userId,
      date,
      dto,
    );
  }
}
