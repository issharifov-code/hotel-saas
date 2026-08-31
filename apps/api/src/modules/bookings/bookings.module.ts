import { Module } from '@nestjs/common';
import { Booking } from './entities/booking.entity';
import { BookingGroup } from './entities/booking-group.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
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
    RlsModule.forFeature([Booking, BookingGroup, Room, RoomType]),
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
