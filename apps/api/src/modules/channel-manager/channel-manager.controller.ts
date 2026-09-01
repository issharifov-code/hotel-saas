import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ChannelManagerService } from './channel-manager.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { UpsertChannelMappingDto } from './dto/upsert-channel-mapping.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Channel Manager — City Ledger/Rate Plan Restrictions'dagi kabi, yangi
// PermissionModule qiymati qo'shilmadi: bu inventar/mavjudlik-distribution
// mavzusi bo'lgani uchun mavjud BOOKING moduli qayta ishlatiladi (Rate Plan
// Restrictions bilan bir xil naqsh — role-permission-matrix.ts'ga qarang).
@Controller('properties/:propertyId/channels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChannelManagerController {
  constructor(private readonly channelManagerService: ChannelManagerService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.channelManagerService.listChannels(user.tenantId!, propertyId);
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelManagerService.createChannel(
      user.tenantId!,
      propertyId,
      dto,
    );
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.channelManagerService.findChannelById(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelManagerService.updateChannel(
      user.tenantId!,
      propertyId,
      id,
      dto,
    );
  }

  @Get(':id/mappings')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listMappings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.channelManagerService.listMappings(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Put(':id/mappings/:roomTypeId')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  upsertMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: UpsertChannelMappingDto,
  ) {
    return this.channelManagerService.upsertMapping(
      user.tenantId!,
      propertyId,
      id,
      roomTypeId,
      dto,
    );
  }

  @Get(':id/sync-logs')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listSyncLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.channelManagerService.listSyncLogs(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Post(':id/sync')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.channelManagerService.syncChannel(
      user.tenantId!,
      propertyId,
      id,
    );
  }
}
