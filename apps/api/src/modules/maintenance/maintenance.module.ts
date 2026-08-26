import { Module } from '@nestjs/common';
import { MaintenanceTicket } from './entities/maintenance-ticket.entity';
import { Room } from '../rooms/entities/room.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// RolesModule to'g'ridan-to'g'ri import qilingan — Payments sessiyasida
// topilgan qoidaga ko'ra, PermissionsGuard ishlatuvchi har qanday controller'ga
// ega modul buni tranzitiv emas, aniq import qilishi shart.
@Module({
  imports: [RlsModule.forFeature([MaintenanceTicket, Room]), RolesModule],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
