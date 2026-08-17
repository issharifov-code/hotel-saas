import { Controller, Get, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Tenant tomoni (OWNER/ACCOUNTANT, `billing:view` ruxsati): o'z obunasi va
// hisob-fakturalarini ko'rish, HECH QANDAY yozish/o'zgartirish amali yo'q —
// to'lovni faqat platforma admin tasdiqlaydi (admin-billing.controller.ts).
@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @RequirePermission(PermissionModule.BILLING, PermissionAction.VIEW)
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getMySubscription(user.tenantId!);
  }

  @Get('invoices')
  @RequirePermission(PermissionModule.BILLING, PermissionAction.VIEW)
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.listInvoicesForTenant(user.tenantId!);
  }

  @Get('plans')
  @RequirePermission(PermissionModule.BILLING, PermissionAction.VIEW)
  getPlans() {
    return this.billingService.getPlans();
  }
}
