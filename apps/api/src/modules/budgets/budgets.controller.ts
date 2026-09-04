import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { UpsertBudgetYearDto } from './dto/upsert-budget-year.dto';

// Budjet — tijorat jihatdan nozik ma'lumot (mehmonxonaning moliyaviy
// maqsadlari), shuning uchun ACCOUNTING ruxsati talab qilinadi: front-desk
// yoki housekeeping xodimi uni ko'rmaydi.
@Controller('properties/:propertyId/budgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.VIEW)
  listByYear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('year', ParseIntPipe) year: number,
  ) {
    assertYear(year);
    return this.budgetsService.listByYear(user.tenantId!, propertyId, year);
  }

  @Put(':year')
  @RequirePermission(PermissionModule.ACCOUNTING, PermissionAction.EDIT)
  upsertYear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpsertBudgetYearDto,
  ) {
    assertYear(year);
    return this.budgetsService.upsertYear(
      user.tenantId!,
      propertyId,
      year,
      dto.months,
    );
  }
}

// Yil `@Param`/`@Query`dan keladi, ya'ni DTO tekshiruvidan o'tmaydi —
// oqilona oraliq shu yerda tekshiriladi (aks holda masalan yil=0 yoki
// 999999 bilan ma'nosiz yozuvlar paydo bo'lishi mumkin edi).
function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new BadRequestException("Yil 2000-2100 oralig'ida bo'lishi kerak");
  }
}
