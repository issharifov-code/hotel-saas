import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { AdjustLoyaltyPointsDto } from './dto/adjust-loyalty-points.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

@Controller('guests/:guestId/loyalty')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('transactions')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('guestId') guestId: string,
  ) {
    return this.loyaltyService.getTransactions(user.tenantId!, guestId);
  }

  @Post('adjust')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.EDIT)
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('guestId') guestId: string,
    @Body() dto: AdjustLoyaltyPointsDto,
  ) {
    return this.loyaltyService.adjustPoints(
      user.tenantId!,
      guestId,
      dto.points,
      dto.reason,
      user.userId,
    );
  }
}
