import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('menu-items')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Get()
  @RequirePermission(PermissionModule.POS, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query('activeOnly') activeOnly?: string) {
    return this.menuItemsService.list(user.tenantId!, activeOnly === 'true');
  }

  @Post()
  @RequirePermission(PermissionModule.POS, PermissionAction.CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMenuItemDto) {
    return this.menuItemsService.create(user.tenantId!, dto);
  }
}
