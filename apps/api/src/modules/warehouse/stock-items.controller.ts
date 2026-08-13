import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { StockItemsService } from './stock-items.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('stock-items')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockItemsController {
  constructor(private readonly stockItemsService: StockItemsService) {}

  @Get()
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query('activeOnly') activeOnly?: string) {
    return this.stockItemsService.list(user.tenantId!, activeOnly === 'true');
  }

  @Post()
  @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStockItemDto) {
    return this.stockItemsService.create(user.tenantId!, dto);
  }
}
