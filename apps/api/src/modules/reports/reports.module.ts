import { Module } from '@nestjs/common';
import { Room } from '../rooms/entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Invoice } from '../invoicing/entities/invoice.entity';
import { InvoicePayment } from '../invoicing/entities/invoice-payment.entity';
import { HousekeepingTask } from '../housekeeping/entities/housekeeping-task.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Agency } from '../agencies/entities/agency.entity';
import { CorporateAccount } from '../city-ledger/entities/corporate-account.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { MaintenanceTicket } from '../maintenance/entities/maintenance-ticket.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  // Reports moduli faqat o'qish uchun — boshqa modullarning entity'lariga
  // to'g'ridan-to'g'ri ulanadi (aylanma bog'liqlikdan qochish uchun, GuestsModule'ning
  // Booking'ga bo'lgan munosabati bilan bir xil naqsh), o'zining biznes-mantiqiga ega
  // bo'lgan modulni import qilmaydi.
  imports: [
    RlsModule.forFeature([
      Room,
      Booking,
      Invoice,
      InvoicePayment,
      HousekeepingTask,
      Guest,
      Agency,
      CorporateAccount,
      Budget,
      MaintenanceTicket,
    ]),
    RolesModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
