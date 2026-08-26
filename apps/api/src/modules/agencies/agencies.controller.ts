import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Turizm agentliklari (Travel Agents / Corporate Accounts) — Night Audit va
// Group Booking'dagi kabi, yangi PermissionModule qiymati qo'shilmadi:
// mavjud BOOKING moduli qayta ishlatiladi (agentlik ro'yxati/yaratish ham
// bron boshqaruvining bir qismi).
@Controller('properties/:propertyId/agencies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.agenciesService.listByProperty(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.agenciesService.findById(user.tenantId!, propertyId, id);
  }

  @Get(':id/summary')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.agenciesService.getSummary(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateAgencyDto,
  ) {
    return this.agenciesService.create(user.tenantId!, propertyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
  ) {
    return this.agenciesService.update(user.tenantId!, propertyId, id, dto);
  }
}
