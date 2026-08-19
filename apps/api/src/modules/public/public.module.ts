import { Module } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { PublicTenantGuard } from './public-tenant.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { PropertiesModule } from '../properties/properties.module';
import { RoomsModule } from '../rooms/rooms.module';
import { BookingsModule } from '../bookings/bookings.module';
import { GuestsModule } from '../guests/guests.module';

// Booking Engine (jonli, autentifikatsiyasiz bron widget'i) — mavjud
// TenantsService (subdomain qidiruvi), PropertiesService, RoomTypesService/
// RatePlansService, BookingsService va GuestsService'ni birlashtiradi.
// Hech qanday yangi entity/migratsiya kerak emas.
@Module({
  imports: [
    TenantsModule,
    PropertiesModule,
    RoomsModule,
    BookingsModule,
    GuestsModule,
  ],
  controllers: [PublicBookingController],
  providers: [PublicBookingService, PublicTenantGuard],
})
export class PublicModule {}
