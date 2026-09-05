import { Module } from '@nestjs/common';
import { Booking } from './entities/booking.entity';
import { BookingGroup } from './entities/booking-group.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
import { Property } from '../properties/entities/property.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingGroupsController } from './booking-groups.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';
import { RolesModule } from '../roles/roles.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { InvoicingModule } from '../invoicing/invoicing.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { CityLedgerModule } from '../city-ledger/city-ledger.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [
    // `Property` faqat entity sifatida — bron valyutasi mulkning
    // `currency` maydonidan olinadi (2026-09-05, audit №12: ilgari hamma
    // joyda `'UZS'` qattiq yozilgan edi).
    RlsModule.forFeature([Booking, BookingGroup, Room, RoomType, Property]),
    RoomsModule,
    GuestsModule,
    RolesModule,
    HousekeepingModule,
    InvoicingModule,
    AgenciesModule,
    CityLedgerModule,
  ],
  providers: [BookingsService],
  controllers: [BookingsController, BookingGroupsController],
  exports: [BookingsService],
})
export class BookingsModule {}
