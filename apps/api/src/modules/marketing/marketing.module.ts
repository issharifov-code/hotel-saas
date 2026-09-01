import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoRequest } from './entities/demo-request.entity';
import { MarketingService } from './marketing.service';
import { DemoRequestController } from './demo-request.controller';
import { AdminDemoRequestsController } from './admin-demo-requests.controller';

// Login sahifasidagi "Demo so'rash" formasi. demo_requests jadvali hech qanday
// tenant'ga tegishli emas (users/billing/tenants kabi) — shuning uchun oddiy
// TypeOrmModule.forFeature ishlatiladi, RlsModule emas.
@Module({
  imports: [TypeOrmModule.forFeature([DemoRequest])],
  providers: [MarketingService],
  controllers: [DemoRequestController, AdminDemoRequestsController],
})
export class MarketingModule {}
