import { Module } from '@nestjs/common';
import { NightAuditRun } from './entities/night-audit-run.entity';
import { Property } from '../properties/entities/property.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { NightAuditService } from './night-audit.service';
import { NightAuditController } from './night-audit.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';
import { RoomsModule } from '../rooms/rooms.module';
import { InvoicingModule } from '../invoicing/invoicing.module';

@Module({
  imports: [
    RlsModule.forFeature([NightAuditRun, Property, Booking, Room]),
    RolesModule,
    RoomsModule,
    InvoicingModule,
  ],
  providers: [NightAuditService],
  controllers: [NightAuditController],
  exports: [NightAuditService],
})
export class NightAuditModule {}
