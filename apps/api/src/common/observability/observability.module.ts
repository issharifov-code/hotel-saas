import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorEvent } from './entities/error-event.entity';
import { ErrorEventsService } from './error-events.service';
import { NotificationsService } from './notifications.service';
import { AdminErrorEventsController } from './admin-error-events.controller';

// 📊 KUZATUV (2026-09-05).
//
// `@Global` — `AllExceptionsFilter` `APP_FILTER` orqali global ro'yxatdan
// o'tadi va `ErrorEventsService` ga muhtoj; global modulsiz uni har bir
// modulga import qilish kerak bo'lardi.
//
// DIQQAT: bu yerda `TypeOrmModule.forFeature` ATAYLAB ishlatilgan,
// `RlsModule.forFeature` EMAS. Farqi muhim: RLS variant so'rovning o'z
// tranzaksiyasidagi ulanishni beradi — xato yuz berganda esa o'sha
// tranzaksiya rollback qilinadi va xato yozuvi ham u bilan birga
// yo'qolardi. Oddiy repository pool ulanishidan foydalanadi, ya'ni
// yozuv so'rovning taqdiridan mustaqil.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ErrorEvent])],
  controllers: [AdminErrorEventsController],
  providers: [ErrorEventsService, NotificationsService],
  exports: [ErrorEventsService, NotificationsService],
})
export class ObservabilityModule {}
