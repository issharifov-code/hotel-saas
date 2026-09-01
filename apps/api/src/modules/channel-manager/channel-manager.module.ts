import { Module } from '@nestjs/common';
import { Channel } from './entities/channel.entity';
import { ChannelRoomTypeMapping } from './entities/channel-room-type-mapping.entity';
import { ChannelSyncLog } from './entities/channel-sync-log.entity';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelManagerController } from './channel-manager.controller';
import { MockChannelAdapter } from './adapters/mock-channel.adapter';
import { CHANNEL_ADAPTERS } from './interfaces/channel-adapter.interface';
import { RoomsModule } from '../rooms/rooms.module';
import { BookingsModule } from '../bookings/bookings.module';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// RoomsModule (RoomTypesService/RatePlansService/RatePlanRestrictionsService)
// va BookingsModule (BookingsService.countAvailableRoomsOfType) to'liq modul
// sifatida import qilinadi — PublicModule'dagi (Booking Engine) bir xil
// naqsh, aylanma bog'liqlik xavfi yo'q (ChannelManagerModule yangi va uni
// hech kim import qilmaydi).
@Module({
  imports: [
    RlsModule.forFeature([Channel, ChannelRoomTypeMapping, ChannelSyncLog]),
    RoomsModule,
    BookingsModule,
    RolesModule,
  ],
  controllers: [ChannelManagerController],
  providers: [
    MockChannelAdapter,
    {
      // Kelajakda haqiqiy OTA API adapteri qo'shilganda, uni shu yerga
      // (providers va useFactory massiviga) qo'shish kifoya.
      provide: CHANNEL_ADAPTERS,
      useFactory: (mock: MockChannelAdapter) => [mock],
      inject: [MockChannelAdapter],
    },
    ChannelManagerService,
  ],
  exports: [ChannelManagerService],
})
export class ChannelManagerModule {}
