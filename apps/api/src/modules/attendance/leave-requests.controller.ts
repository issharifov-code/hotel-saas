import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { LeaveRequestStatus } from './entities/leave-request.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/leave-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('userId') userId?: string,
    @Query('status') status?: LeaveRequestStatus,
  ) {
    return this.leaveRequestsService.list(user.tenantId!, propertyId, {
      userId,
      status,
    });
  }

  @Post()
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.create(
      user.tenantId!,
      propertyId,
      user.userId,
      dto,
    );
  }

  @Post(':id/approve')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.APPROVE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveRequestsService.approve(
      user.tenantId!,
      propertyId,
      id,
      user.userId,
      dto,
    );
  }

  @Post(':id/reject')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.APPROVE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveRequestsService.reject(
      user.tenantId!,
      propertyId,
      id,
      user.userId,
      dto,
    );
  }

  @Post(':id/cancel')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.leaveRequestsService.cancel(user.tenantId!, propertyId, id);
  }
}
