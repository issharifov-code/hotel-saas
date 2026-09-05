import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { AgencyCommissionsService } from './agency-commissions.service';
import { AgencyCommissionStatus } from './entities/agency-commission.entity';
import { PayAgencyCommissionsDto } from './dto/pay-agency-commissions.dto';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Turizm agentliklari (Travel Agents / Corporate Accounts) — Night Audit va
// Group Booking'dagi kabi, yangi PermissionModule qiymati qo'shilmadi:
// mavjud BOOKING moduli qayta ishlatiladi (agentlik ro'yxati/yaratish ham
// bron boshqaruvining bir qismi).
@Controller('properties/:propertyId/agencies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgenciesController {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly commissionsService: AgencyCommissionsService,
  ) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.agenciesService.listByProperty(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.agenciesService.findById(user.tenantId!, propertyId, id);
  }

  @Get(':id/summary')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.commissionsService.getSummary(user.tenantId!, propertyId, id);
  }

  // Komissiya qatorlari — qaysi bron uchun qancha, to'landimi.
  @Get(':id/commissions')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listCommissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Query('status') status?: AgencyCommissionStatus,
  ) {
    return this.commissionsService.listByAgency(user.tenantId!, propertyId, id, status);
  }

  @Get(':id/commission-payments')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.commissionsService.listPayments(user.tenantId!, propertyId, id);
  }

  // 🔴 To'lov — bosh kitobga provodka yozadi (qarz kamayadi, kassa/bank
  // kamayadi). Shuning uchun bu yerda BOOKING emas, ACCOUNTING/APPROVE
  // huquqi talab qilinadi: agentlik kartochkasini tahrirlay oladigan
  // administrator avtomatik ravishda pul chiqara olmasligi kerak.
  @Post(':id/commission-payments')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.APPROVE)
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: PayAgencyCommissionsDto,
  ) {
    return this.commissionsService.pay(user.tenantId!, propertyId, id, dto, user.userId ?? null);
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateAgencyDto,
  ) {
    return this.agenciesService.create(user.tenantId!, propertyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
  ) {
    return this.agenciesService.update(user.tenantId!, propertyId, id, dto);
  }
}
