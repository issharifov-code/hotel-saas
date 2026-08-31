import { Module } from '@nestjs/common';
import { MessageTemplate } from './entities/message-template.entity';
import { MessageLog } from './entities/message-log.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MockMessageAdapter } from './adapters/mock-message.adapter';
import { MESSAGE_ADAPTERS } from './interfaces/message-provider.interface';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// Guest/Booking/Room/Property faqat entity sifatida ro'yxatdan o'tkaziladi
// (mos modullarning o'zi emas) — Agencies/GuestsModule'dagi naqshga o'xshab,
// aylanma bog'liqlikdan qochish uchun (faqat merge-field render qilish va
// mehmon/bron kontaktini o'qish uchun kerak).
@Module({
  imports: [
    RlsModule.forFeature([
      MessageTemplate,
      MessageLog,
      Guest,
      Booking,
      Room,
      Property,
    ]),
    RolesModule,
  ],
  controllers: [MessagingController],
  providers: [
    MockMessageAdapter,
    {
      // Kelajakda haqiqiy email/SMS provayder qo'shilganda, uni shu yerga
      // (providers va useFactory massiviga) qo'shish kifoya.
      provide: MESSAGE_ADAPTERS,
      useFactory: (mock: MockMessageAdapter) => [mock],
      inject: [MockMessageAdapter],
    },
    MessagingService,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
