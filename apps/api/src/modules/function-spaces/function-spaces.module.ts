import { Module } from '@nestjs/common';
import { FunctionSpace } from './entities/function-space.entity';
import { FunctionSpaceBooking } from './entities/function-space-booking.entity';
import { FunctionSpacesService } from './function-spaces.service';
import { FunctionSpacesController } from './function-spaces.controller';
import { FunctionSpaceBookingsController } from './function-space-bookings.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// RolesModule to'g'ridan-to'g'ri import qilingan — Payments sessiyasida
// topilgan qoidaga ko'ra, PermissionsGuard ishlatuvchi har qanday controller'ga
// ega modul buni tranzitiv emas, aniq import qilishi shart.
@Module({
  imports: [
    RlsModule.forFeature([FunctionSpace, FunctionSpaceBooking]),
    RolesModule,
  ],
  providers: [FunctionSpacesService],
  controllers: [FunctionSpacesController, FunctionSpaceBookingsController],
  exports: [FunctionSpacesService],
})
export class FunctionSpacesModule {}
