import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { HousekeepingTaskStatus } from './entities/housekeeping-task.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/housekeeping')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Get('rooms')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.VIEW)
  listRoomStatuses(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.housekeepingService.listRoomStatuses(user.tenantId!, propertyId);
  }

  @Get('tasks')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.VIEW)
  listTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: HousekeepingTaskStatus,
  ) {
    return this.housekeepingService.listTasks(user.tenantId!, propertyId, status);
  }

  @Post('tasks')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.CREATE)
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateHousekeepingTaskDto,
  ) {
    return this.housekeepingService.createTask(user.tenantId!, propertyId, dto);
  }

  @Post('tasks/:id/start')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  start(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.housekeepingService.start(user.tenantId!, propertyId, id, user.userId);
  }

  @Post('tasks/:id/complete')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.housekeepingService.complete(user.tenantId!, propertyId, id);
  }

  @Post('tasks/:id/inspect')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.APPROVE)
  inspect(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.housekeepingService.inspect(user.tenantId!, propertyId, id, user.userId);
  }

  @Post('tasks/:id/cancel')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.housekeepingService.cancel(user.tenantId!, propertyId, id);
  }
}
