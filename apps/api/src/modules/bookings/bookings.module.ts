import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';
import { RolesModule } from '../roles/roles.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Room, RoomType]),
    RoomsModule,
    GuestsModule,
    RolesModule,
    HousekeepingModule,
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
