import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CityLedgerService } from './city-ledger.service';
import { CreateCorporateAccountDto } from './dto/create-corporate-account.dto';
import { UpdateCorporateAccountDto } from './dto/update-corporate-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// City Ledger / Korporativ hisoblar (Corporate Accounts) — Agencies'dagi kabi,
// yangi PermissionModule qiymati qo'shilmadi: bu moliyaviy xarakterdagi
// (kredit limiti, hisob-varaq/statement) modul bo'lgani uchun mavjud
// INVOICING moduli qayta ishlatiladi (Buxgalter/Front Desk allaqachon shu
// modulga ega — role-permission-matrix.ts'ga qarang).
@Controller('properties/:propertyId/corporate-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CityLedgerController {
  constructor(private readonly cityLedgerService: CityLedgerService) {}

  @Get()
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.cityLedgerService.listByProperty(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.cityLedgerService.findById(user.tenantId!, propertyId, id);
  }

  @Get(':id/statement')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.VIEW)
  getStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.cityLedgerService.getStatement(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateCorporateAccountDto,
  ) {
    return this.cityLedgerService.create(user.tenantId!, propertyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.INVOICING, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCorporateAccountDto,
  ) {
    return this.cityLedgerService.update(user.tenantId!, propertyId, id, dto);
  }
}
