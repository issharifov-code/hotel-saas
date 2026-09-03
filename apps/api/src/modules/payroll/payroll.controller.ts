import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayslipEntryDto } from './dto/update-payslip-entry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Payroll — yangi PermissionModule.PAYROLL (Night Audit/Group Booking'dagi
// kabi mavjud modulni qayta ishlatish o'rniga alohida qiymat qo'shildi,
// chunki bu moliyaviy VA maxfiy (xodim maoshi) xarakterdagi modul — ACCOUNTING
// yoki USERS_ROLES bilan aralashtirib bo'lmaydi).
@Controller('properties/:propertyId/payroll-runs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.payrollService.listRuns(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.payrollService.getRun(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payrollService.createRun(
      user.tenantId!,
      propertyId,
      user.userId,
      dto,
    );
  }

  @Patch(':id/entries/:entryId')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  updateEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdatePayslipEntryDto,
  ) {
    return this.payrollService.updateEntry(
      user.tenantId!,
      propertyId,
      id,
      entryId,
      dto,
    );
  }

  @Post(':id/finalize')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.APPROVE)
  finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.payrollService.finalizeRun(
      user.tenantId!,
      propertyId,
      id,
      user.userId,
    );
  }

  @Post(':id/mark-paid')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.APPROVE)
  markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.payrollService.markPaid(
      user.tenantId!,
      propertyId,
      id,
      user.userId,
    );
  }
}
