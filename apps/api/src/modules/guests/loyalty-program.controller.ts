import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import {
  POINTS_PER_CURRENCY_UNIT,
  TIER_THRESHOLDS,
} from './loyalty-formula.util';

// Sodiqlik dasturining QOIDALARI (2026-09-04).
//
// Bu qiymatlar frontend'da takrorlanmaydi, ataylab shu yerdan o'qiladi:
// bo'sag'a yoki ball formulasi o'zgarsa, ikkita joyda emas, BITTA joyda
// o'zgaradi. Hozircha butun platforma uchun bitta standart — kelajakda
// tenant-sozlanadigan bo'lganda shu endpoint tenant qiymatini qaytaradi va
// frontend o'zgarishsiz ishlayveradi.
@Controller('loyalty')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LoyaltyProgramController {
  @Get('program')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  program() {
    return {
      pointsPerCurrencyUnit: POINTS_PER_CURRENCY_UNIT,
      // Pastdan yuqoriga saralab beramiz — jadvalda ham shu tartibda
      // ko'rsatiladi (Bronza -> Platina), qiyoslash tabiiyroq bo'ladi.
      tiers: TIER_THRESHOLDS.map(([tier, threshold]) => ({
        tier,
        threshold,
      })).sort((a, b) => a.threshold - b.threshold),
    };
  }
}
