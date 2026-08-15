import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PosOutletsService } from './pos-outlets.service';
import { CreatePosOutletDto } from './dto/create-pos-outlet.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/pos-outlets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosOutletsController {
  constructor(private readonly posOutletsService: PosOutletsService) {}

  @Get()
  @RequirePermission(PermissionModule.POS, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.posOutletsService.listByProperty(user.tenantId!, propertyId);
  }

  @Post()
  @RequirePermission(PermissionModule.POS, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePosOutletDto,
  ) {
    return this.posOutletsService.create(user.tenantId!, propertyId, dto.name);
  }
}
