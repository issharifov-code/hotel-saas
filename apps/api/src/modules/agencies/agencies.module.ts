import { Module } from '@nestjs/common';
import { Agency } from './entities/agency.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// `Booking` faqat entity sifatida ro'yxatdan o'tkaziladi (BookingsModule emas)
// — GuestsModule'ning Invoice/PosOrder naqshiga o'xshab, aylanma bog'liqlikdan
// qochish uchun. Faqat komissiya hisobotini o'qish (getSummary) uchun kerak.
@Module({
  imports: [RlsModule.forFeature([Agency, Booking]), RolesModule],
  providers: [AgenciesService],
  controllers: [AgenciesController],
  exports: [AgenciesService],
})
export class AgenciesModule {}
