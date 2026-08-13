import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { StockService } from './stock.service';
import { IssueStockDto } from './dto/issue-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseStockController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly stockService: StockService,
  ) {}

  @Get('warehouses')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  listWarehouses(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.warehousesService.listByProperty(user.tenantId!, propertyId);
  }

  @Get('warehouses/:warehouseId/stock-levels')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  async stockLevels(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    await this.warehousesService.findById(user.tenantId!, propertyId, warehouseId);
    return this.stockService.getStockLevels(user.tenantId!, warehouseId);
  }

  @Get('warehouses/:warehouseId/transactions')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  async transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('warehouseId') warehouseId: string,
    @Query('stockItemId') stockItemId?: string,
  ) {
    await this.warehousesService.findById(user.tenantId!, propertyId, warehouseId);
    return this.stockService.listTransactions(user.tenantId!, warehouseId, stockItemId);
  }

  @Post('warehouses/:warehouseId/issue')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.CREATE)
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: IssueStockDto,
  ) {
    await this.warehousesService.findById(user.tenantId!, propertyId, warehouseId);
    return this.stockService.issue(user.tenantId!, warehouseId, dto, user.userId);
  }

  @Post('warehouses/:warehouseId/adjust')
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.EDIT)
  async adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: AdjustStockDto,
  ) {
    await this.warehousesService.findById(user.tenantId!, propertyId, warehouseId);
    return this.stockService.adjust(user.tenantId!, warehouseId, dto, user.userId);
  }
}
