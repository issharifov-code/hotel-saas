import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { AddInvoiceLineDto } from './dto/add-invoice-line.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get('invoices')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoicingService.listByProperty(user.tenantId!, propertyId, status);
  }

  @Get('invoices/:id')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.invoicingService.findById(user.tenantId!, propertyId, id);
  }

  @Get('bookings/:bookingId/invoice')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  getByBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.invoicingService.findByBooking(user.tenantId!, propertyId, bookingId);
  }

  @Post('invoices/:id/lines')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.CREATE)
  addLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: AddInvoiceLineDto,
  ) {
    return this.invoicingService.addLine(user.tenantId!, propertyId, id, dto);
  }

  @Post('invoices/:id/payments')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.CREATE)
  addPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.invoicingService.addPayment(user.tenantId!, propertyId, id, dto, user.userId);
  }

  @Post('invoices/:id/cancel')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.EDIT)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.invoicingService.cancel(user.tenantId!, propertyId, id);
  }
}
