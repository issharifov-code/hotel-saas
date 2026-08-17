import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { SubscriptionInvoiceStatus } from './entities/subscription-invoice.entity';

// Platforma super-admin uchun (Tenant Management bilan bir xil himoya —
// `PlatformAdminGuard`, tenant permission matritsasidan mustaqil). Bu yerda
// barcha tenant'lar bo'yicha hisob-fakturalar ko'riladi/yaratiladi/tasdiqlanadi.
@Controller('admin/billing')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  listAll(@Query('tenantId') tenantId?: string, @Query('status') status?: SubscriptionInvoiceStatus) {
    return this.billingService.listAllInvoices({ tenantId, status });
  }

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Post('tenants/:tenantId/invoices')
  generate(@Param('tenantId') tenantId: string, @Body() dto: GenerateInvoiceDto) {
    return this.billingService.generateInvoice(tenantId, dto);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.markPaid(id, user.userId);
  }

  @Post('invoices/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.billingService.cancelInvoice(id);
  }
}
