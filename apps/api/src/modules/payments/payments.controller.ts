import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ChargeInvoiceDto } from './dto/charge-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// `invoicing` ruxsat moduli ostida — to'lov qabul qilish (qo'lda yoki
// shlyuz orqali) bir xil huquq darajasini talab qiladi.
@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payment-providers')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  listProviders() {
    return this.paymentsService.listProviders();
  }

  @Post('invoices/:id/charge')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.CREATE)
  charge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: ChargeInvoiceDto,
  ) {
    return this.paymentsService.chargeInvoice(
      user.tenantId!,
      propertyId,
      id,
      dto,
      user.userId,
    );
  }
}
