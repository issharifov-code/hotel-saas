import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { MergeGuestsDto } from './dto/merge-guests.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

@Controller('guests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    // `search` — eski umumiy maydon (saqlanadi, boshqa joylarda ishlatiladi);
    // qolganlari 2026-09-04 da qo'shilgan alohida qidiruv maydonlari.
    @Query('search') search?: string,
    @Query('name') name?: string,
    @Query('communication') communication?: string,
    @Query('documentNumber') documentNumber?: string,
    @Query('nationality') nationality?: string,
  ) {
    return this.guestsService.list(user.tenantId!, {
      search,
      name,
      communication,
      documentNumber,
      nationality,
    });
  }

  // ':id' route'idan OLDIN e'lon qilinishi shart — aks holda Nest "duplicates"ni
  // ':id' parametri sifatida moslashtirib qo'yadi.
  @Get('duplicates')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  duplicates(@CurrentUser() user: AuthenticatedUser) {
    return this.guestsService.findDuplicateGroups(user.tenantId!);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.guestsService.findById(user.tenantId!, id);
  }

  @Post()
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGuestDto) {
    return this.guestsService.create(user.tenantId!, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.update(user.tenantId!, id, dto);
  }

  @Get(':id/stays')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  stays(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.guestsService.getStayHistory(user.tenantId!, id);
  }

  // Ikkilanma mehmonni asosiy mehmonga birlashtiradi — buzilmas (destruktiv)
  // amal bo'lgani uchun DELETE ruxsati talab qilinadi (EDIT emas).
  @Post(':id/merge')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.DELETE)
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MergeGuestsDto,
  ) {
    return this.guestsService.mergeGuests(
      user.tenantId!,
      id,
      dto.duplicateGuestId,
    );
  }
}
