import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import type { JournalEntrySourceModule } from './entities/journal-entry.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/accounting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.listAccounts(user.tenantId!);
  }

  @Get('journal-entries')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  listJournalEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sourceModule') sourceModule?: JournalEntrySourceModule,
  ) {
    return this.accountingService.listJournalEntries(user.tenantId!, propertyId, { from, to, sourceModule });
  }

  @Post('journal-entries')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.CREATE)
  createManualEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accountingService.createManualEntry(user.tenantId!, propertyId, user.userId, dto);
  }

  @Get('trial-balance')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  getTrialBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.accountingService.getTrialBalance(user.tenantId!, propertyId, asOfDate);
  }

  @Get('income-statement')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  getIncomeStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.accountingService.getIncomeStatement(user.tenantId!, propertyId, from, to);
  }
}
