import { Module } from '@nestjs/common';
import { Guest } from './entities/guest.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Invoice } from '../invoicing/entities/invoice.entity';
import { PosOrder } from '../pos/entities/pos-order.entity';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyProgramController } from './loyalty-program.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  // Booking/Invoice/PosOrder shu yerda faqat entity darajasida — tegishli
  // modullar (Bookings, Invoicing) o'zlari Guests'ga bog'liq bo'lgani sababli,
  // aylanma modul bog'liqligidan qochish uchun modul emas, faqat entity import
  // qilinadi (InvoicingService'dagi bilan bir xil naqsh). Merge (birlashtirish)
  // funksiyasi uchun yozish huquqi kerak, shuning uchun barchasi RLS-repository.
  imports: [
    RlsModule.forFeature([
      Guest,
      LoyaltyTransaction,
      Booking,
      Invoice,
      PosOrder,
    ]),
    RolesModule,
  ],
  providers: [GuestsService, LoyaltyService],
  controllers: [GuestsController, LoyaltyController, LoyaltyProgramController],
  exports: [GuestsService, LoyaltyService],
})
export class GuestsModule {}
