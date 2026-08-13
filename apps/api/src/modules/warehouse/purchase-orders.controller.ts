import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { WarehousesService } from './warehouses.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { PurchaseOrderStatus } from './entities/purchase-order.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/purchase-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly warehousesService: WarehousesService,
  ) {}

  @Get()
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: PurchaseOrderStatus,
  ) {
    return this.purchaseOrdersService.listByProperty(user.tenantId!, propertyId, status);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.purchaseOrdersService.findById(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    const warehouse = await this.warehousesService.getOrCreateDefault(user.tenantId!, propertyId);
    return this.purchaseOrdersService.create(user.tenantId!, propertyId, warehouse.id, user.userId, dto);
  }

  @Post(':id/approve')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.purchaseOrdersService.approve(user.tenantId!, propertyId, id, user.userId);
  }

  @Post(':id/reject')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.purchaseOrdersService.reject(user.tenantId!, propertyId, id, user.userId);
  }

  @Post(':id/cancel')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.EDIT)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.purchaseOrdersService.cancel(user.tenantId!, propertyId, id);
  }

  @Post(':id/receive')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.EDIT)
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.receive(user.tenantId!, propertyId, id, dto, user.userId);
  }
}
