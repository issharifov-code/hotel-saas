import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

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
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.tenantsService.updateStatus(id, dto.status);
  }
}
