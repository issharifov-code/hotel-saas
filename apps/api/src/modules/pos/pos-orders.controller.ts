import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PosOrdersService } from './pos-orders.service';
import { PosOutletsService } from './pos-outlets.service';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { PosOrderStatus } from './entities/pos-order.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/pos-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosOrdersController {
  constructor(
    private readonly posOrdersService: PosOrdersService,
    private readonly posOutletsService: PosOutletsService,
  ) {}

  @Get()
  @RequirePermission(PermissionModule.POS, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: PosOrderStatus,
  ) {
    return this.posOrdersService.listByProperty(user.tenantId!, propertyId, status);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.POS, PermissionAction.VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.posOrdersService.findById(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.POS, PermissionAction.CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePosOrderDto,
  ) {
    // outletId ko'rsatilgan bo'lsa (bir nechta savdo nuqtasi mavjud mulklarda) — o'sha
    // outlet tanlanadi (mavjudligi va shu tenant/mulkka tegishliligi tekshiriladi).
    // Ko'rsatilmasa — avvalgidek default outlet (lazy-create) ishlatiladi.
    const outlet = dto.outletId
      ? await this.posOutletsService.findById(user.tenantId!, propertyId, dto.outletId)
      : await this.posOutletsService.getOrCreateDefault(user.tenantId!, propertyId);
    return this.posOrdersService.create(user.tenantId!, propertyId, outlet.id, user.userId, dto);
  }

  @Post(':id/items')
  @RequirePermission(PermissionModule.POS, PermissionAction.EDIT)
  addItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.posOrdersService.addItems(user.tenantId!, propertyId, id, dto);
  }

  @Post(':id/pay')
  @RequirePermission(PermissionModule.POS, PermissionAction.EDIT)
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
  ) {
    return this.posOrdersService.pay(user.tenantId!, propertyId, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PermissionModule.POS, PermissionAction.EDIT)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.posOrdersService.cancel(user.tenantId!, propertyId, id);
  }
}
