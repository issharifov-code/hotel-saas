import { Controller, Delete, UseGuards } from '@nestjs/common';
import { SampleDataService } from './sample-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Faqat tenant o'z namunaviy ma'lumotlarini o'chirishi uchun (buzilmas/destruktiv
// amal — shu sabab `tenant_settings:delete` talab qilinadi, standart rollarda
// faqat OWNER'ga berilgan, xuddi Guest CRM merge'dagi kabi).
@Controller('sample-data')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SampleDataController {
  constructor(private readonly sampleDataService: SampleDataService) {}

  @Delete()
  @RequirePermission(PermissionModule.TENANT_SETTINGS, PermissionAction.DELETE)
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.sampleDataService.removeSampleData(user.tenantId!);
  }
}
