import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { ResolveMaintenanceTicketDto } from './dto/resolve-maintenance-ticket.dto';
import { MaintenanceTicketStatus } from './entities/maintenance-ticket.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Texnik xizmat so'rovlari (Maintenance) — Night Audit/Group Booking/Agencies/
// Function Spaces'dagi kabi, yangi PermissionModule qiymati qo'shilmadi:
// mavjud HOUSEKEEPING moduli qayta ishlatiladi (Housekeeping'ga eng yaqin
// operatsion vazifa turi — ikkalasi ham "xona holatini boshqarish" oilasidan).
@Controller('properties/:propertyId/maintenance-tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: MaintenanceTicketStatus,
  ) {
    return this.maintenanceService.listTickets(
      user.tenantId!,
      propertyId,
      status,
    );
  }

  @Get(':id')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.maintenanceService.findTicketById(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Post()
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateMaintenanceTicketDto,
  ) {
    return this.maintenanceService.createTicket(
      user.tenantId!,
      propertyId,
      dto,
      user.userId,
    );
  }

  @Post(':id/start')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.maintenanceService.start(
      user.tenantId!,
      propertyId,
      id,
      user.userId,
    );
  }

  @Post(':id/resolve')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: ResolveMaintenanceTicketDto,
  ) {
    return this.maintenanceService.resolve(user.tenantId!, propertyId, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PermissionModule.HOUSEKEEPING, PermissionAction.EDIT)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.maintenanceService.cancel(user.tenantId!, propertyId, id);
  }
}
