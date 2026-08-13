import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { TenantStatus } from './entities/tenant.entity';

// Bu controller faqat platforma super-admin uchun (Tenant Management, 6.3-bo'lim).
// Tenant o'zini o'zi ro'yxatdan o'tkazishi AuthController.registerTenant orqali amalga oshadi.
@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list() {
    return this.tenantsService.listAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: TenantStatus) {
    return this.tenantsService.updateStatus(id, status);
  }
}
