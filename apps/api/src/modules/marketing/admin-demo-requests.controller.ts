import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { MarkContactedDto } from './dto/mark-contacted.dto';

// Platforma super-admin uchun — Login sahifasidan kelgan "Demo so'rash"
// murojaatlarini ko'rish (AdminBillingController bilan bir xil himoya).
@Controller('admin/demo-requests')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminDemoRequestsController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get()
  list() {
    return this.marketingService.listDemoRequests();
  }

  @Patch(':id/contacted')
  markContacted(@Param('id') id: string, @Body() dto: MarkContactedDto) {
    return this.marketingService.markContacted(id, dto.contacted);
  }
}
