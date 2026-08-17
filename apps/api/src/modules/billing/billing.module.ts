import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionInvoice } from './entities/subscription-invoice.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AdminBillingController } from './admin-billing.controller';
import { RolesModule } from '../roles/roles.module';

// `tenants`/`users` bilan bir xil sabab: bu jadvallar tenant-scoped emas
// (platforma darajasida), shuning uchun `RlsModule.forFeature` emas, oddiy
// global `TypeOrmModule.forFeature` ishlatiladi (batafsil izoh: entity fayli).
@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionInvoice, Tenant]), RolesModule],
  providers: [BillingService],
  controllers: [BillingController, AdminBillingController],
  exports: [BillingService],
})
export class BillingModule {}
