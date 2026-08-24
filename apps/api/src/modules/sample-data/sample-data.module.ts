import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SampleDataService } from './sample-data.service';
import { SampleDataController } from './sample-data.controller';
import { RolesModule } from '../roles/roles.module';

// `tenants` bilan bir xil sabab (billing/tenants modullaridagi izohga qarang):
// bu jadval tenant-scoped RLS ostida emas, shuning uchun oddiy `TypeOrmModule.forFeature`
// ishlatiladi. Barcha operatsion (RLS-himoyalangan) jadvallar SampleDataService ichida
// o'zining alohida DataSource-tranzaksiyasi orqali (RlsModule'siz, qo'lda set_config bilan)
// boshqariladi — batafsil izoh: sample-data.service.ts.
// `RolesModule` — `PermissionsGuard`ga RolesService kerak (Payments moduli sessiyasida
// topilgan qoida: PermissionsGuard ishlatuvchi har bir modul buni to'g'ridan-to'g'ri import qilishi shart).
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), RolesModule],
  providers: [SampleDataService],
  controllers: [SampleDataController],
  exports: [SampleDataService],
})
export class SampleDataModule {}
