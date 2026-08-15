import { Module } from '@nestjs/common';
import { Guest } from './entities/guest.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  // Booking shu yerda faqat CRM stay-history so'rovi (o'qish) uchun — BookingsModule
  // o'zi Guests'ga bog'liq bo'lgani sababli, aylanma bog'liqlikdan qochish uchun
  // BookingsModule import qilinmaydi, faqat entity (InvoicingService'dagi bilan bir xil naqsh).
  imports: [
    RlsModule.forFeature([Guest, LoyaltyTransaction, Booking]),
    RolesModule,
  ],
  providers: [GuestsService, LoyaltyService],
  controllers: [GuestsController, LoyaltyController],
  exports: [GuestsService, LoyaltyService],
})
export class GuestsModule {}
