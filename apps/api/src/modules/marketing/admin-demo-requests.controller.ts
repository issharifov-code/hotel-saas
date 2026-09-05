import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M13). Ilgari limitsiz edi — izoh
  // `MarketingService.listDemoRequests` da.
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.marketingService.listDemoRequests(page, pageSize);
  }

  @Patch(':id/contacted')
  markContacted(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkContactedDto,
  ) {
    return this.marketingService.markContacted(id, dto.contacted);
  }
}
