import { Module } from '@nestjs/common';
import { Agency } from './entities/agency.entity';
import { AgencyCommission } from './entities/agency-commission.entity';
import { AgencyCommissionPayment } from './entities/agency-commission-payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../guests/entities/guest.entity';
import { AgenciesService } from './agencies.service';
import { AgencyCommissionsService } from './agency-commissions.service';
import { AgenciesController } from './agencies.controller';
import { RolesModule } from '../roles/roles.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RlsModule } from '../../common/rls/rls.module';

// `Booking` faqat entity sifatida ro'yxatdan o'tkaziladi (BookingsModule emas)
// — GuestsModule'ning Invoice/PosOrder naqshiga o'xshab, aylanma bog'liqlikdan
// qochish uchun. BookingsModule esa AgenciesModule'ni import qiladi, ya'ni
// yo'nalish bitta: Bookings -> Agencies -> Accounting.
@Module({
  imports: [
    RlsModule.forFeature([
      Agency,
      AgencyCommission,
      AgencyCommissionPayment,
      Booking,
      Guest,
    ]),
    RolesModule,
    AccountingModule,
  ],
  providers: [AgenciesService, AgencyCommissionsService],
  controllers: [AgenciesController],
  exports: [AgenciesService, AgencyCommissionsService],
})
export class AgenciesModule {}
