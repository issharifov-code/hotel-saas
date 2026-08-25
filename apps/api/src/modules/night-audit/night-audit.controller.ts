import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NightAuditService } from './night-audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Night Audit ("kunni yopish") — Front Desk modulining permission darajasidan
// foydalanadi. Alohida yangi PermissionModule qo'shish Postgres
// `permissions_module_enum`ga ALTER TYPE migratsiyasini talab qilardi;
// buning o'rniga mavjud FRONT_DESK moduli qayta ishlatildi — xuddi
// check-in/check-out kabi, Night Audit ham kun yakunidagi tasdiqlash
// (APPROVE) amali hisoblanadi.
@Controller('properties/:propertyId/night-audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NightAuditController {
  constructor(private readonly nightAuditService: NightAuditService) {}

  @Get('status')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.VIEW)
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.nightAuditService.getStatus(user.tenantId!, propertyId);
  }

  @Get('history')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.VIEW)
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.nightAuditService.history(user.tenantId!, propertyId);
  }

  @Post('run')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.APPROVE)
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.nightAuditService.run(user.tenantId!, propertyId, user.userId);
  }
}
